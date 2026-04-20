from rest_framework import serializers
from users.models import User


class UserCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "phone_country_code",
            "phone_number",
            "password_hash",
            "auth_provider",
            "provider_user_id",
            "two_fa_enabled",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, data):
        if not data.get("email") and not data.get("phone_number"):
            raise serializers.ValidationError(
                "A user must have at least an email or a phone number."
            )
        return data
