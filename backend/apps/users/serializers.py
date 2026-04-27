from rest_framework import serializers
from apps.users.models import UserProfile


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
    last_name = serializers.CharField(max_length=100, min_length=2)
    email = serializers.EmailField(required=False, allow_blank=True)
    gender = serializers.ChoiceField(choices=UserProfile.Gender.choices)
    city = serializers.CharField(max_length=100, min_length=2)


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
    city = serializers.CharField(allow_blank=True)
    gender = serializers.CharField(allow_blank=True)
    phone_verified = serializers.BooleanField()
    aadhaar_verified = serializers.BooleanField()
    member_since = serializers.CharField()