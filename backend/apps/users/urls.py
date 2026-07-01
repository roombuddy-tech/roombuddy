from django.urls import path

from apps.users.views import (
    SendOTPView,
    VerifyOTPView,
    CompleteProfileView,
    RefreshTokenView,
    HostDashboardView,
    UserProfileView,
    PublicProfileView,
    UpdateProfileView,
    SendEmailVerificationView,
    VerifyEmailView,
    VerifyEmailWebView,
    VerificationStatusView,
    SubmitIDVerificationView,
    PendingVerificationsView,
    ReviewIDVerificationView,
    PayoutAccountsListView,
    AddBankAccountView,
    AddUPIView,
    DeletePayoutAccountView,
    DeleteAccountView,
    SetPrimaryPayoutView,
    UploadProfilePhotoView,
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
    path("profile/upload-photo/", UploadProfilePhotoView.as_view(), name="upload-profile-photo"),
    path("profile/email/send-verification/", SendEmailVerificationView.as_view(), name="send-email-verification"),
    path("profile/email/verify/", VerifyEmailView.as_view(), name="verify-email"),
    path("profile/email/verify-link/", VerifyEmailWebView.as_view(), name="verify-email-web"),
    path("profile/verification-status/", VerificationStatusView.as_view(), name="verification-status"),
    path("profile/id-verification/submit/", SubmitIDVerificationView.as_view(), name="submit-id-verification"),
    path("profile/delete-account/", DeleteAccountView.as_view(), name="delete-account"),

    # Public profile (host viewing guest, guest viewing host)
    path("<uuid:user_id>/public-profile/", PublicProfileView.as_view(), name="public-profile"),

    # Payout accounts
    path("profile/payout-accounts/", PayoutAccountsListView.as_view(), name="payout-accounts-list"),
    path("profile/payout-accounts/add-bank/", AddBankAccountView.as_view(), name="add-bank-account"),
    path("profile/payout-accounts/add-upi/", AddUPIView.as_view(), name="add-upi"),
    path("profile/payout-accounts/<uuid:account_id>/delete/", DeletePayoutAccountView.as_view(), name="delete-payout-account"),
    path("profile/payout-accounts/<uuid:account_id>/set-primary/", SetPrimaryPayoutView.as_view(), name="set-primary-payout"),

    # Host
    path("host/dashboard/", HostDashboardView.as_view(), name="host-dashboard"),

    # Admin — ID verification review
    path("admin/verifications/pending/", PendingVerificationsView.as_view(), name="pending-verifications"),
    path("admin/verifications/review/", ReviewIDVerificationView.as_view(), name="review-id-verification"),
]