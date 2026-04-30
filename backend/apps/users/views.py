from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema
from apps.users.serializers import UserProfileResponseSerializer
from django.template.loader import render_to_string
from apps.users.services import get_user_profile
from django.http import HttpResponse
from apps.users.services import verify_email_token
from apps.users.models import User

from apps.users.serializers import (
    SendOTPSerializer,
    VerifyOTPSerializer,
    CompleteProfileSerializer,
    RefreshTokenSerializer,
    UserProfileResponseSerializer,
    OTPSentResponseSerializer,
    OTPVerifiedResponseSerializer,
    ProfileResponseSerializer,
    RefreshResponseSerializer,
    DashboardResponseSerializer,
    UpdateProfileSerializer,
    UpdateProfileResponseSerializer,
    SendEmailVerificationSerializer,
    VerifyEmailSerializer,
    EmailVerificationResponseSerializer,
    VerificationStatusResponseSerializer,
    AddBankAccountSerializer,
    AddUPISerializer,
    PayoutAccountsListResponseSerializer,
    PayoutAccountResponseSerializer,
)
from apps.users.services import (
    send_otp_to_phone,
    verify_otp_and_login,
    complete_user_profile,
    refresh_access_token,
    get_host_dashboard,
    get_user_profile,
    update_user_profile,
    send_email_verification,
    verify_email_token,
    get_verification_status,
    AuthServiceError,
    get_payout_accounts,
    add_bank_account,
    add_upi_account,
    delete_payout_account,
    set_primary_payout_account,
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

class UserProfileView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Auth"], responses={200: UserProfileResponseSerializer})
    def get(self, request):
        result = get_user_profile(request.user)
        return Response(result, status=status.HTTP_200_OK)
    

class UpdateProfileView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = UpdateProfileSerializer

    @extend_schema(tags=["Profile"], request=UpdateProfileSerializer, responses={200: UpdateProfileResponseSerializer})
    def patch(self, request):
        serializer = UpdateProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = update_user_profile(request.user, serializer.validated_data)
        except AuthServiceError as e:
            return _error_response(e)
        return Response(result, status=status.HTTP_200_OK)


class SendEmailVerificationView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = SendEmailVerificationSerializer

    @extend_schema(tags=["Profile"], request=SendEmailVerificationSerializer, responses={200: EmailVerificationResponseSerializer})
    def post(self, request):
        serializer = SendEmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = send_email_verification(request.user, serializer.validated_data["email"])
        except AuthServiceError as e:
            return _error_response(e)
        return Response(result, status=status.HTTP_200_OK)


class VerifyEmailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = VerifyEmailSerializer

    @extend_schema(tags=["Profile"], request=VerifyEmailSerializer, responses={200: EmailVerificationResponseSerializer})
    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = verify_email_token(request.user, serializer.validated_data["token"])
        except AuthServiceError as e:
            return _error_response(e)
        return Response(result, status=status.HTTP_200_OK)


class VerificationStatusView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Profile"], responses={200: VerificationStatusResponseSerializer})
    def get(self, request):
        result = get_verification_status(request.user)
        return Response(result, status=status.HTTP_200_OK)
    
class VerifyEmailWebView(APIView):
    """
    GET /api/users/profile/email/verify-link/?token=xxx&user_id=xxx
    Public endpoint. Called when user clicks the verification link in their email.
    """

    authentication_classes = []
    permission_classes = []

    @extend_schema(tags=["Profile"])
    def get(self, request):
        token = request.query_params.get("token", "")
        user_id = request.query_params.get("user_id", "")

        if not token or not user_id:
            return self._render("emails/verify_error.html", {"message": "Missing verification parameters."})

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return self._render("emails/verify_error.html", {"message": "User not found."})

        try:
            
            result = verify_email_token(user, token)
            return self._render("emails/verify_success.html", {"email": result["email"]})
        except Exception as e:
            return self._render("emails/verify_error.html", {"message": str(e)})

    @staticmethod
    def _render(template_name: str, context: dict) -> HttpResponse:
        html = render_to_string(template_name, context)
        return HttpResponse(html, content_type="text/html")
    

class PayoutAccountsListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Profile"], responses={200: PayoutAccountsListResponseSerializer})
    def get(self, request):
        results = get_payout_accounts(request.user)
        return Response({"count": len(results), "results": results})


class AddBankAccountView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = AddBankAccountSerializer

    @extend_schema(tags=["Profile"], request=AddBankAccountSerializer, responses={201: PayoutAccountResponseSerializer})
    def post(self, request):
        serializer = AddBankAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = add_bank_account(request.user, serializer.validated_data)
        return Response(result, status=status.HTTP_201_CREATED)

class AddUPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = AddUPISerializer

    @extend_schema(tags=["Profile"], request=AddUPISerializer, responses={201: PayoutAccountResponseSerializer})
    def post(self, request):
        serializer = AddUPISerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = add_upi_account(request.user, serializer.validated_data)
        return Response(result, status=status.HTTP_201_CREATED)


class DeletePayoutAccountView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Profile"])
    def delete(self, request, account_id):
        try:
            delete_payout_account(request.user, account_id)
        except AuthServiceError as e:
            return _error_response(e)
        return Response({"message": "Account deleted"}, status=status.HTTP_200_OK)

class SetPrimaryPayoutView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Profile"], responses={200: PayoutAccountResponseSerializer})
    def post(self, request, account_id):
        try:
            result = set_primary_payout_account(request.user, account_id)
        except AuthServiceError as e:
            return _error_response(e)
        return Response(result)