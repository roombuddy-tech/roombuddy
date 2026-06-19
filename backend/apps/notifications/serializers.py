from rest_framework import serializers

from .models import (
    EventType,
    Notification,
    NotificationChannel,
    UserNotificationPreference,
)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id", "event_type", "channel", "subject", "body",
            "status", "created_at", "sent_at", "read_at", "payload",
        ]
        read_only_fields = fields


class NotificationPreferenceSerializer(serializers.Serializer):
    event_type = serializers.ChoiceField(choices=EventType.choices)
    channel = serializers.ChoiceField(choices=NotificationChannel.choices)
    enabled = serializers.BooleanField()


class BulkPreferenceUpdateSerializer(serializers.Serializer):
    preferences = NotificationPreferenceSerializer(many=True)