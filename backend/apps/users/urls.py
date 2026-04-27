from django.urls import path

from apps.users.views import (
    SendOTPView,
    VerifyOTPView,
    CompleteProfileView,
    RefreshTokenView,
    HostDashboardView,
    UserProfileView,
)

urlpatterns = [
    path("auth/otp/send/", SendOTPView.as_view(), name="send-otp"),
    path("auth/otp/verify/", VerifyOTPView.as_view(), name="verify-otp"),
    path("auth/profile/complete/", CompleteProfileView.as_view(), name="complete-profile"),
    path("auth/token/refresh/", RefreshTokenView.as_view(), name="refresh-token"),
    path("host/dashboard/", HostDashboardView.as_view(), name="host-dashboard"),
    path("profile/me/", UserProfileView.as_view(), name="user-profile"),
]