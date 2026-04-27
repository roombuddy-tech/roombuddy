from django.urls import path

from apps.users.views import (
    SendOTPView,
    VerifyOTPView,
    CompleteProfileView,
    RefreshTokenView,
    HostDashboardView,
    UserProfileView,
    UpdateProfileView,
    SendEmailVerificationView,
    VerifyEmailView,
    VerificationStatusView,
)

urlpatterns = [
    # Auth
    path("auth/otp/send/", SendOTPView.as_view(), name="send-otp"),
    path("auth/otp/verify/", VerifyOTPView.as_view(), name="verify-otp"),
    path("auth/profile/complete/", CompleteProfileView.as_view(), name="complete-profile"),
    path("auth/token/refresh/", RefreshTokenView.as_view(), name="refresh-token"),

    # Profile
    path("profile/me/", UserProfileView.as_view(), name="user-profile"),
    path("profile/update/", UpdateProfileView.as_view(), name="update-profile"),
    path("profile/email/send-verification/", SendEmailVerificationView.as_view(), name="send-email-verification"),
    path("profile/email/verify/", VerifyEmailView.as_view(), name="verify-email"),
    path("profile/verification-status/", VerificationStatusView.as_view(), name="verification-status"),

    # Host
    path("host/dashboard/", HostDashboardView.as_view(), name="host-dashboard"),
]