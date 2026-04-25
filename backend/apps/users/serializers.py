from rest_framework import serializers
from apps.users.models import UserProfile


class SendOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    country_code = serializers.CharField(max_length=5, default="+91")

    def validate_phone_number(self, value):
        cleaned = value.replace(" ", "").replace("-", "")
        if not cleaned.isdigit() or len(cleaned) != 10:
            raise serializers.ValidationError("Enter a valid 10-digit phone number.")
        if cleaned[0] not in "6789":
            raise serializers.ValidationError("Indian phone numbers must start with 6, 7, 8, or 9.")
        return cleaned


class VerifyOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    otp_code = serializers.CharField(max_length=6, min_length=6)
    country_code = serializers.CharField(max_length=5, default="+91")

    def validate_phone_number(self, value):
        cleaned = value.replace(" ", "").replace("-", "")
        if not cleaned.isdigit() or len(cleaned) != 10:
            raise serializers.ValidationError("Enter a valid 10-digit phone number.")
        return cleaned

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