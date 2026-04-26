from datetime import timedelta

import jwt
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import models
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


class HostDashboardView(APIView):
    """
    GET /api/users/host/dashboard/
    Authenticated endpoint. Returns aggregated dashboard data for the host.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Host"],
        responses={
            200: inline_serializer("HostDashboardResponse", fields={
                "greeting_name": s.CharField(),
                "this_month": inline_serializer("ThisMonth", fields={
                    "earnings": s.DecimalField(max_digits=10, decimal_places=2),
                    "bookings": s.IntegerField(),
                    "occupancy_pct": s.IntegerField(),
                    "occupancy_nights_booked": s.IntegerField(),
                    "occupancy_nights_total": s.IntegerField(),
                    "avg_rating": s.DecimalField(max_digits=3, decimal_places=1, allow_null=True),
                    "review_count": s.IntegerField(),
                    "response_rate_pct": s.IntegerField(),
                }),
                "today": inline_serializer("TodayActivity", fields={
                    "check_ins": s.ListField(child=s.DictField()),
                    "check_outs": s.ListField(child=s.DictField()),
                    "recent_reviews": s.ListField(child=s.DictField()),
                }),
            }),
        },
    )
    def get(self, request):
        user = request.user
        today = timezone.now().date()
        month_start = today.replace(day=1)

        # Import here to avoid circular imports
        from apps.bookings.models import Booking
        from apps.reviews.models import Review

        # ── Greeting name ─────────────────────────────────
        try:
            greeting_name = user.profile.first_name
        except UserProfile.DoesNotExist:
            greeting_name = "Host"

        # ── This month stats ──────────────────────────────
        month_bookings = Booking.objects.filter(
            host_user=user,
            check_in_date__gte=month_start,
        )

        completed_bookings = month_bookings.filter(
            status__in=["completed", "active"]
        )

        earnings = completed_bookings.aggregate(
            total=models.Sum("total_host_receives")
        )["total"] or 0

        booking_count = completed_bookings.count()

        # Occupancy: booked nights / days in month so far
        days_in_month = (today - month_start).days + 1
        booked_nights = 0
        for b in completed_bookings:
            start = max(b.check_in_date, month_start)
            end = min(b.check_out_date, today)
            if end > start:
                booked_nights += (end - start).days

        occupancy_pct = round((booked_nights / days_in_month) * 100) if days_in_month > 0 else 0

        # Avg rating
        reviews = Review.objects.filter(
            reviewee_user=user,
            review_type="guest_to_host",
        )
        review_agg = reviews.aggregate(
            avg=models.Avg("overall_rating"),
            count=models.Count("id"),
        )
        avg_rating = round(review_agg["avg"], 1) if review_agg["avg"] else None
        review_count = review_agg["count"]

        # Response rate: responded bookings / total bookings that needed response
        total_needing_response = Booking.objects.filter(
            host_user=user,
            booking_mode="request",
        ).count()
        responded = Booking.objects.filter(
            host_user=user,
            booking_mode="request",
            host_responded_at__isnull=False,
        ).count()
        response_rate = round((responded / total_needing_response) * 100) if total_needing_response > 0 else 100

        # ── Today activity ────────────────────────────────
        todays_check_ins = Booking.objects.filter(
            host_user=user,
            check_in_date=today,
            status__in=["accepted", "active"],
        ).select_related("guest_user")

        check_ins = []
        for b in todays_check_ins:
            guest_name = "Guest"
            try:
                guest_name = f"{b.guest_user.profile.first_name} {b.guest_user.profile.last_name[0]}."
            except Exception:
                pass
            check_ins.append({
                "booking_code": b.booking_code,
                "guest_name": guest_name,
                "nights": b.nights,
                "check_in_time": "3 PM",
            })

        todays_check_outs = Booking.objects.filter(
            host_user=user,
            check_out_date=today,
            status="active",
        ).select_related("guest_user")

        check_outs = []
        for b in todays_check_outs:
            guest_name = "Guest"
            try:
                guest_name = f"{b.guest_user.profile.first_name} {b.guest_user.profile.last_name[0]}."
            except Exception:
                pass
            check_outs.append({
                "booking_code": b.booking_code,
                "guest_name": guest_name,
            })

        # Recent reviews
        recent_reviews_qs = reviews.order_by("-submitted_at")[:3]
        recent_reviews = []
        for r in recent_reviews_qs:
            reviewer_name = "Guest"
            try:
                reviewer_name = f"{r.reviewer_user.profile.first_name} {r.reviewer_user.profile.last_name[0]}."
            except Exception:
                pass
            recent_reviews.append({
                "reviewer_name": reviewer_name,
                "rating": r.overall_rating,
                "body": (r.body or "")[:100],
                "submitted_at": r.submitted_at.isoformat(),
            })

        return Response({
            "greeting_name": greeting_name,
            "this_month": {
                "earnings": float(earnings),
                "bookings": booking_count,
                "occupancy_pct": occupancy_pct,
                "occupancy_nights_booked": booked_nights,
                "occupancy_nights_total": days_in_month,
                "avg_rating": float(avg_rating) if avg_rating else None,
                "review_count": review_count,
                "response_rate_pct": response_rate,
            },
            "today": {
                "check_ins": check_ins,
                "check_outs": check_outs,
                "recent_reviews": recent_reviews,
            },
        })