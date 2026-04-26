from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.users.serializers import (
    SendOTPSerializer,
    VerifyOTPSerializer,
    CompleteProfileSerializer,
    RefreshTokenSerializer,
    OTPSentResponseSerializer,
    OTPVerifiedResponseSerializer,
    ProfileResponseSerializer,
    RefreshResponseSerializer,
    DashboardResponseSerializer,
)
from apps.users.services import (
    send_otp_to_phone,
    verify_otp_and_login,
    complete_user_profile,
    refresh_access_token,
    get_host_dashboard,
    AuthServiceError,
)
from common.authentication import JWTAuthentication
from common.permissions import IsAuthenticated
from common.utils import get_client_ip


def _error_response(err: AuthServiceError) -> Response:
    """Convert service error to DRF Response."""
    return Response(
        {"error": err.message, "code": err.code},
        status=err.status_code,
    )


class SendOTPView(APIView):
    authentication_classes = []
    permission_classes = []
    serializer_class = SendOTPSerializer

    @extend_schema(tags=["Auth"], request=SendOTPSerializer, responses={200: OTPSentResponseSerializer})
    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = send_otp_to_phone(
                phone_number=serializer.validated_data["phone_number"],
                country_code=serializer.validated_data["country_code"],
            )
        except AuthServiceError as e:
            return _error_response(e)

        return Response(result, status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
    authentication_classes = []
    permission_classes = []
    serializer_class = VerifyOTPSerializer

    @extend_schema(tags=["Auth"], request=VerifyOTPSerializer, responses={200: OTPVerifiedResponseSerializer})
    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = verify_otp_and_login(
                phone_number=serializer.validated_data["phone_number"],
                country_code=serializer.validated_data["country_code"],
                otp_code=serializer.validated_data["otp_code"],
                request_meta={
                    "device_name": request.META.get("HTTP_X_DEVICE_NAME", ""),
                    "device_os": request.META.get("HTTP_X_DEVICE_OS", ""),
                    "ip_address": get_client_ip(request),
                },
            )
        except AuthServiceError as e:
            return _error_response(e)

        return Response(result, status=status.HTTP_200_OK)


class CompleteProfileView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = CompleteProfileSerializer

    @extend_schema(tags=["Auth"], request=CompleteProfileSerializer, responses={200: ProfileResponseSerializer})
    def post(self, request):
        serializer = CompleteProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = complete_user_profile(request.user, serializer.validated_data)
        return Response(result, status=status.HTTP_200_OK)


class RefreshTokenView(APIView):
    authentication_classes = []
    permission_classes = []
    serializer_class = RefreshTokenSerializer

    @extend_schema(tags=["Auth"], request=RefreshTokenSerializer, responses={200: RefreshResponseSerializer})
    def post(self, request):
        serializer = RefreshTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = refresh_access_token(serializer.validated_data["refresh_token"])
        except AuthServiceError as e:
            return _error_response(e)

        return Response(result, status=status.HTTP_200_OK)


class HostDashboardView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Host"], responses={200: DashboardResponseSerializer})
    def get(self, request):
        result = get_host_dashboard(request.user)
        return Response(result, status=status.HTTP_200_OK)