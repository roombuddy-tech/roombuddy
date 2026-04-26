from datetime import timedelta

import jwt
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as s

from apps.users.models import User, OTPCode, UserSession, UserProfile
from apps.users.serializers import (
    SendOTPSerializer,
    VerifyOTPSerializer,
    CompleteProfileSerializer,
    RefreshTokenSerializer,
)
from common.authentication import JWTAuthentication
from common.jwt_utils import (
    generate_access_token,
    generate_refresh_token,
    decode_token,
    hash_token,
    REFRESH_TOKEN_LIFETIME_DAYS,
)
from common.permissions import IsAuthenticated
from third_party.otp import generate_otp, send_otp


OTP_RATE_LIMIT_PER_HOUR = 5
OTP_EXPIRY_MINUTES = 5


class SendOTPView(APIView):
    """
    POST /api/users/auth/otp/send/
    Public endpoint. Creates user if new, generates OTP, sends via SMS.
    """

    authentication_classes = []
    permission_classes = []
    serializer_class = SendOTPSerializer

    @extend_schema(
        tags=["Auth"],
        request=SendOTPSerializer,
        responses={
            200: inline_serializer("SendOTPResponse", fields={
                "message": s.CharField(),
                "phone": s.CharField(),
                "expires_in_seconds": s.IntegerField(),
            }),
            429: inline_serializer("RateLimitError", fields={
                "error": s.CharField(),
                "code": s.CharField(),
            }),
        },
    )
    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone_number = serializer.validated_data["phone_number"]
        country_code = serializer.validated_data["country_code"]
        full_phone = f"{country_code}{phone_number}"

        # Rate limit: max N OTPs per phone per hour
        one_hour_ago = timezone.now() - timedelta(hours=1)
        recent_count = OTPCode.objects.filter(
            phone=full_phone, created_at__gte=one_hour_ago
        ).count()

        if recent_count >= OTP_RATE_LIMIT_PER_HOUR:
            return Response(
                {"error": "Too many OTP requests. Please try again later.", "code": "RATE_LIMITED"},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # Find or create user
        user, created = User.objects.get_or_create(
            phone_number=phone_number,
            phone_country_code=country_code,
            defaults={"status": User.Status.ACTIVE},
        )

        # Check if user is banned/suspended
        if user.status != User.Status.ACTIVE:
            return Response(
                {"error": "Your account is not active. Please contact support.", "code": "ACCOUNT_INACTIVE"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Generate OTP
        otp_code = generate_otp(length=6)

        # Store hashed OTP
        OTPCode.objects.create(
            user=user,
            phone=full_phone,
            otp_hash=OTPCode.hash_otp(otp_code),
            expires_at=timezone.now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
        )

        # Send OTP via configured provider
        sent = send_otp(full_phone, otp_code)
        if not sent:
            return Response(
                {"error": "Failed to send OTP. Please try again.", "code": "OTP_SEND_FAILED"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "message": "OTP sent successfully",
                "phone": full_phone,
                "expires_in_seconds": OTP_EXPIRY_MINUTES * 60,
            },
            status=status.HTTP_200_OK,
        )


class VerifyOTPView(APIView):
    """
    POST /api/users/auth/otp/verify/
    Public endpoint. Verifies OTP, issues JWT tokens, creates session.
    """

    authentication_classes = []
    permission_classes = []
    serializer_class = VerifyOTPSerializer

    @extend_schema(
        tags=["Auth"],
        request=VerifyOTPSerializer,
        responses={
            200: inline_serializer("VerifyOTPResponse", fields={
                "message": s.CharField(),
                "tokens": inline_serializer("TokenPair", fields={
                    "access": s.CharField(),
                    "refresh": s.CharField(),
                }),
                "is_new_user": s.BooleanField(),
                "is_profile_complete": s.BooleanField(),
            }),
            400: inline_serializer("OTPError", fields={
                "error": s.CharField(),
                "code": s.CharField(),
                "attempts_remaining": s.IntegerField(required=False),
            }),
        },
    )
    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone_number = serializer.validated_data["phone_number"]
        country_code = serializer.validated_data["country_code"]
        otp_code = serializer.validated_data["otp_code"]
        full_phone = f"{country_code}{phone_number}"

        # Find user
        try:
            user = User.objects.get(
                phone_number=phone_number,
                phone_country_code=country_code,
            )
        except User.DoesNotExist:
            return Response(
                {"error": "No account found for this phone number.", "code": "USER_NOT_FOUND"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Find latest unconsumed OTP for this phone
        otp_record = (
            OTPCode.objects.filter(phone=full_phone, is_consumed=False)
            .order_by("-created_at")
            .first()
        )

        if not otp_record:
            return Response(
                {"error": "No OTP found. Please request a new one.", "code": "OTP_NOT_FOUND"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp_record.is_expired:
            return Response(
                {"error": "OTP has expired. Please request a new one.", "code": "OTP_EXPIRED"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp_record.is_max_attempts:
            return Response(
                {"error": "Too many incorrect attempts. Please request a new OTP.", "code": "MAX_ATTEMPTS"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify OTP hash
        if not otp_record.verify(otp_code):
            attempts_remaining = otp_record.max_attempts - otp_record.attempt_count
            return Response(
                {
                    "error": "Incorrect OTP. Please try again.",
                    "code": "INVALID_OTP",
                    "attempts_remaining": max(attempts_remaining, 0),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # OTP verified — update user
        is_first_login = user.phone_verified_at is None
        user.phone_verified_at = timezone.now()
        user.last_login_at = timezone.now()
        user.save(update_fields=["phone_verified_at", "last_login_at", "updated_at"])

        # Create session
        session = UserSession.objects.create(
            user=user,
            refresh_token_hash="",
            device_name=request.META.get("HTTP_X_DEVICE_NAME", ""),
            device_os=request.META.get("HTTP_X_DEVICE_OS", ""),
            ip_address=self._get_client_ip(request),
            expires_at=timezone.now() + timedelta(days=REFRESH_TOKEN_LIFETIME_DAYS),
        )

        # Generate tokens
        access_token = generate_access_token(user.id)
        refresh_token = generate_refresh_token(user.id, session.id)

        # Store hashed refresh token
        session.refresh_token_hash = hash_token(refresh_token)
        session.save(update_fields=["refresh_token_hash"])

        return Response(
            {
                "message": "OTP verified successfully",
                "tokens": {
                    "access": access_token,
                    "refresh": refresh_token,
                },
                "is_new_user": is_first_login,
                "is_profile_complete": user.is_profile_complete,
            },
            status=status.HTTP_200_OK,
        )

    @staticmethod
    def _get_client_ip(request):
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")


class CompleteProfileView(APIView):
    """
    POST /api/users/auth/profile/complete/
    Authenticated endpoint. Creates/updates user profile.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = CompleteProfileSerializer

    @extend_schema(
        tags=["Auth"],
        request=CompleteProfileSerializer,
        responses={
            200: inline_serializer("ProfileResponse", fields={
                "user_id": s.UUIDField(),
                "display_name": s.CharField(),
                "is_profile_complete": s.BooleanField(),
            }),
        },
    )
    def post(self, request):
        serializer = CompleteProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        data = serializer.validated_data

        profile, created = UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "first_name": data["first_name"],
                "last_name": data["last_name"],
                "email": data.get("email") or None,
                "gender": data["gender"],
                "city": data["city"],
            },
        )

        if not user.is_profile_complete:
            user.is_profile_complete = True
            user.save(update_fields=["is_profile_complete", "updated_at"])

        return Response(
            {
                "user_id": str(user.id),
                "display_name": profile.display_name,
                "is_profile_complete": True,
            },
            status=status.HTTP_200_OK,
        )


class RefreshTokenView(APIView):
    """
    POST /api/users/auth/token/refresh/
    Public endpoint. Validates refresh token, issues new access token.
    """

    authentication_classes = []
    permission_classes = []
    serializer_class = RefreshTokenSerializer

    @extend_schema(
        tags=["Auth"],
        request=RefreshTokenSerializer,
        responses={
            200: inline_serializer("RefreshResponse", fields={
                "access": s.CharField(),
            }),
            401: inline_serializer("RefreshError", fields={
                "error": s.CharField(),
                "code": s.CharField(),
            }),
        },
    )
    def post(self, request):
        serializer = RefreshTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        refresh_token = serializer.validated_data["refresh_token"]

        try:
            payload = decode_token(refresh_token)
        except jwt.ExpiredSignatureError:
            return Response(
                {"error": "Refresh token has expired. Please log in again.", "code": "REFRESH_EXPIRED"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except jwt.InvalidTokenError:
            return Response(
                {"error": "Invalid refresh token.", "code": "INVALID_REFRESH"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if payload.get("type") != "refresh":
            return Response(
                {"error": "Invalid token type.", "code": "INVALID_TOKEN_TYPE"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        session_id = payload.get("session_id")
        user_id = payload.get("user_id")

        try:
            session = UserSession.objects.get(id=session_id, user_id=user_id)
        except UserSession.DoesNotExist:
            return Response(
                {"error": "Session not found.", "code": "SESSION_NOT_FOUND"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not session.is_active:
            return Response(
                {"error": "Session has been revoked or expired.", "code": "SESSION_INACTIVE"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if session.refresh_token_hash != hash_token(refresh_token):
            session.revoke()
            return Response(
                {"error": "Invalid refresh token. Session revoked.", "code": "TOKEN_MISMATCH"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        new_access_token = generate_access_token(user_id)
        session.save(update_fields=["last_active_at"])

        return Response(
            {"access": new_access_token},
            status=status.HTTP_200_OK,
        )