import logging
import re

from rest_framework import serializers

from apps.users.models import UserProfile
from third_party.ifsc import IFSCUnavailable, lookup_ifsc

logger = logging.getLogger(__name__)


# ─── Reusable mixin ─────────────────────────────────────────

class PhoneValidationMixin:
    """Shared phone number validation logic."""

    def validate_phone_number(self, value):
        cleaned = value.replace(" ", "").replace("-", "")
        if not cleaned.isdigit() or len(cleaned) != 10:
            raise serializers.ValidationError("Enter a valid 10-digit phone number.")
        if cleaned[0] not in "6789":
            raise serializers.ValidationError("Indian phone numbers must start with 6, 7, 8, or 9.")
        return cleaned


# ─── Input serializers (request body) ────────────────────────

class SendOTPSerializer(PhoneValidationMixin, serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    country_code = serializers.CharField(max_length=5, default="+91")
    mode = serializers.ChoiceField(choices=["auto", "login", "signup"], default="auto", required=False)


class VerifyOTPSerializer(PhoneValidationMixin, serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    otp_code = serializers.CharField(max_length=6, min_length=6)
    country_code = serializers.CharField(max_length=5, default="+91")

    def validate_otp_code(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("OTP must be numeric.")
        return value


class CompleteProfileSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100, min_length=2)
    last_name = serializers.CharField(max_length=100, min_length=1)
    email = serializers.EmailField(required=False, allow_blank=True)
    gender = serializers.ChoiceField(choices=UserProfile.Gender.choices, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, min_length=2, required=False, allow_blank=True)


class RefreshTokenSerializer(serializers.Serializer):
    refresh_token = serializers.CharField()


# ─── Output serializers (response DTOs) ──────────────────────

class OTPSentResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    phone = serializers.CharField()
    expires_in_seconds = serializers.IntegerField()


class TokenPairSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class OTPVerifiedResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    tokens = TokenPairSerializer()
    is_new_user = serializers.BooleanField()
    is_profile_complete = serializers.BooleanField()


class ProfileResponseSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    display_name = serializers.CharField()
    is_profile_complete = serializers.BooleanField()


class RefreshResponseSerializer(serializers.Serializer):
    access = serializers.CharField()


# ─── Dashboard DTOs ──────────────────────────────────────────

class MonthStatsSerializer(serializers.Serializer):
    earnings = serializers.FloatField()
    bookings = serializers.IntegerField()
    occupancy_pct = serializers.IntegerField()
    occupancy_nights_booked = serializers.IntegerField()
    occupancy_nights_total = serializers.IntegerField()
    avg_rating = serializers.FloatField(allow_null=True)
    review_count = serializers.IntegerField()
    response_rate_pct = serializers.IntegerField()


class CheckInItemSerializer(serializers.Serializer):
    booking_code = serializers.CharField()
    guest_name = serializers.CharField()
    nights = serializers.IntegerField()
    check_in_time = serializers.CharField()


class CheckOutItemSerializer(serializers.Serializer):
    booking_code = serializers.CharField()
    guest_name = serializers.CharField()


class ReviewItemSerializer(serializers.Serializer):
    reviewer_name = serializers.CharField()
    rating = serializers.IntegerField()
    body = serializers.CharField()
    submitted_at = serializers.CharField()


class TodayActivitySerializer(serializers.Serializer):
    check_ins = CheckInItemSerializer(many=True)
    check_outs = CheckOutItemSerializer(many=True)
    recent_reviews = ReviewItemSerializer(many=True)


class DashboardResponseSerializer(serializers.Serializer):
    greeting_name = serializers.CharField()
    this_month = MonthStatsSerializer()
    today = TodayActivitySerializer()

# ─── Profile DTOs ─────────────────────────────────────────────

class UserProfileResponseSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    display_name = serializers.CharField()
    initials = serializers.CharField()
    email = serializers.CharField(allow_blank=True)
    profile_photo_url = serializers.CharField(allow_null=True)
    city = serializers.CharField(allow_blank=True)
    gender = serializers.CharField(allow_blank=True)
    date_of_birth = serializers.DateField(allow_null=True)
    phone_verified = serializers.BooleanField()
    email_verified = serializers.BooleanField()
    aadhaar_verified = serializers.BooleanField()
    member_since = serializers.CharField()

# ─── Edit Profile DTOs ────────────────────────────────────────

class UpdateProfileSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100, min_length=2, required=False)
    last_name = serializers.CharField(max_length=100, required=False)
    email = serializers.EmailField(required=False, allow_blank=True)
    gender = serializers.ChoiceField(choices=UserProfile.Gender.choices, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)


class UpdateProfileResponseSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    display_name = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    email = serializers.CharField(allow_blank=True, allow_null=True)
    gender = serializers.CharField()
    city = serializers.CharField()
    date_of_birth = serializers.DateField(allow_null=True)


# ─── Email Verification DTOs ─────────────────────────────────

class SendEmailVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()


class VerifyEmailSerializer(serializers.Serializer):
    token = serializers.CharField()


class EmailVerificationResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    email = serializers.CharField()


class VerificationStatusResponseSerializer(serializers.Serializer):
    phone_verified = serializers.BooleanField()
    phone = serializers.CharField(allow_null=True)
    email_verified = serializers.BooleanField()
    email = serializers.CharField(allow_null=True)
    aadhaar_verified = serializers.BooleanField()

# ─── Payout Account DTOs ──────────────────────────────────────

class AddBankAccountSerializer(serializers.Serializer):
    account_holder_name = serializers.CharField(max_length=200, min_length=2)
    account_number = serializers.CharField(max_length=20, min_length=8)
    confirm_account_number = serializers.CharField(max_length=20)
    ifsc_code = serializers.CharField(max_length=11, min_length=11)
    # Resolved from the IFSC directory when reachable; the client-supplied value
    # is only a fallback, so it isn't required.
    bank_name = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate_account_number(self, value):
        value = value.strip()
        if not value.isdigit():
            raise serializers.ValidationError("Account number must contain digits only.")
        return value

    def validate_ifsc_code(self, value):
        value = value.strip().upper()
        # Format: 4 letters (bank) + '0' (reserved) + 6 alphanumeric (branch).
        if (
            len(value) != 11
            or not value[:4].isalpha()
            or value[4] != "0"
            or not value[5:].isalnum()
        ):
            raise serializers.ValidationError("Enter a valid 11-character IFSC code (e.g. SBIN0001234).")
        return value

    def validate(self, data):
        if data["account_number"] != data["confirm_account_number"].strip():
            raise serializers.ValidationError({"confirm_account_number": "Account numbers do not match."})

        # Verify the IFSC exists and take the bank name from the directory rather
        # than trusting what was typed. If the directory is unreachable we fall
        # back to the supplied name — a lookup outage shouldn't block a host.
        try:
            branch = lookup_ifsc(data["ifsc_code"])
            if branch is None:
                raise serializers.ValidationError(
                    {"ifsc_code": "We couldn't find this IFSC code. Please double-check it."}
                )
            data["bank_name"] = branch["bank"] or data.get("bank_name", "")
        except IFSCUnavailable:
            logger.warning("IFSC directory unavailable; accepting client-supplied bank name")
            data.setdefault("bank_name", "")

        if not data.get("bank_name"):
            raise serializers.ValidationError({"bank_name": "Bank name is required."})
        return data


# Known UPI handles (the part after '@'). Typing an email address instead of a
# UPI ID is the most common mistake here, and this catches it.
UPI_HANDLES = {
    # NPCI / common PSP apps
    "upi", "ybl", "ibl", "axl", "apl", "yapl", "abfspay", "airtel", "freecharge",
    "paytm", "ptyes", "ptaxis", "pthdfc", "ptsbi", "okaxis", "okhdfcbank",
    "okicici", "oksbi", "jupiteraxis", "fam", "naviaxis", "slc", "superyes",
    "timecosmos", "waaxis", "waicici", "wahdfcbank", "wasbi", "rmhdfcbank",
    # Bank handles
    "sbi", "hdfcbank", "icici", "axisbank", "kotak", "pnb", "barodampay",
    "idfcbank", "indus", "yesbank", "unionbank", "uboi", "cnrb", "cbin",
    "federal", "fbl", "rbl", "dbs", "citi", "aubank", "equitas", "idbi",
    "jkb", "kbl", "kvb", "mahb", "myicici", "psb", "sib", "tjsb", "utbi", "uco",
}

UPI_RE = re.compile(r"^[a-zA-Z0-9](?:[a-zA-Z0-9.\-_]{0,255})@[a-zA-Z][a-zA-Z0-9]{1,63}$")


class AddUPISerializer(serializers.Serializer):
    upi_id = serializers.CharField(max_length=100)

    def validate_upi_id(self, value):
        value = value.strip().lower()
        if not UPI_RE.match(value):
            raise serializers.ValidationError(
                "Enter a valid UPI ID (e.g. yourname@oksbi or 9876543210@ybl)."
            )
        handle = value.split("@", 1)[1]
        if "." in handle or handle not in UPI_HANDLES:
            # A dot in the handle almost always means an email was entered.
            raise serializers.ValidationError(
                f"“@{handle}” isn't a recognised UPI handle. Use the UPI ID from your "
                "payment app (e.g. @oksbi, @okhdfcbank, @ybl, @paytm) — not your email address."
            )
        return value


class PayoutAccountResponseSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    account_type = serializers.CharField()
    is_primary = serializers.BooleanField()
    account_holder_name = serializers.CharField(allow_null=True)
    account_number_masked = serializers.CharField()
    ifsc_code = serializers.CharField(allow_null=True)
    bank_name = serializers.CharField(allow_null=True)
    upi_id = serializers.CharField(allow_null=True)


class PayoutAccountsListResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    results = PayoutAccountResponseSerializer(many=True)

# ─── Photo Upload DTOs ────────────────────────────────────────

class UploadProfilePhotoResponseSerializer(serializers.Serializer):
    profile_photo_url = serializers.CharField()
    thumbnail_url = serializers.CharField()