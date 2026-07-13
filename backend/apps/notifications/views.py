from django.utils import timezone
from rest_framework import status
from common.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    DeviceToken,
    EventType,
    Notification,
    NotificationChannel,
    UserNotificationPreference,
)
from .serializers import (
    BulkPreferenceUpdateSerializer,
    NotificationSerializer,
)
import logging

logger = logging.getLogger(__name__)


class NotificationListView(APIView):
    """GET /api/notifications/ — recent notifications for current user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            Notification.objects
            .filter(user=request.user, channel=NotificationChannel.IN_APP)
            .order_by("-created_at")[:50]
        )
        unread_count = Notification.objects.filter(
            user=request.user, channel=NotificationChannel.IN_APP, read_at__isnull=True,
        ).count()
        return Response({
            "notifications": NotificationSerializer(qs, many=True).data,
            "unread_count": unread_count,
        })


class NotificationMarkReadView(APIView):
    """POST /api/notifications/<id>/read/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        updated = Notification.objects.filter(
            id=notification_id, user=request.user, read_at__isnull=True,
        ).update(read_at=timezone.now())
        return Response({"marked_read": updated})


class NotificationMarkAllReadView(APIView):
    """POST /api/notifications/read-all/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated = Notification.objects.filter(
            user=request.user, channel=NotificationChannel.IN_APP, read_at__isnull=True,
        ).update(read_at=timezone.now())
        return Response({"marked_read": updated})


class NotificationPreferencesView(APIView):
    """
    GET /api/notifications/preferences/
    PUT /api/notifications/preferences/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        existing = {
            (p.event_type, p.channel): p.enabled
            for p in UserNotificationPreference.objects.filter(user=request.user)
        }
        result = []
        for event_value, event_label in EventType.choices:
            for channel_value, channel_label in NotificationChannel.choices:
                if channel_value == NotificationChannel.PUSH:
                    continue  # not yet supported; hide from UI
                result.append({
                    "event_type": event_value,
                    "event_label": event_label,
                    "channel": channel_value,
                    "channel_label": channel_label,
                    "enabled": existing.get((event_value, channel_value), True),
                })
        return Response({"preferences": result})

    def put(self, request):
        serializer = BulkPreferenceUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        prefs = serializer.validated_data["preferences"]
        for item in prefs:
            UserNotificationPreference.objects.update_or_create(
                user=request.user,
                event_type=item["event_type"],
                channel=item["channel"],
                defaults={"enabled": item["enabled"]},
            )

        return Response({"updated": len(prefs)})

class DeviceTokenView(APIView):
    """
    POST /api/notifications/device-token/   — register/refresh this device's push token
        body: { "token": "ExponentPushToken[...]", "platform": "ios" | "android" }
    DELETE /api/notifications/device-token/ — deactivate a token (on logout)
        body: { "token": "ExponentPushToken[...]" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = (request.data.get("token") or "").strip()
        platform = (request.data.get("platform") or "").strip()[:16]
        if not token:
            return Response({"error": "token is required"}, status=status.HTTP_400_BAD_REQUEST)

        # A token is unique to a device; reassign it to the current user in case
        # a different account previously logged in on this phone.
        DeviceToken.objects.update_or_create(
            token=token,
            defaults={
                "user": request.user,
                "platform": platform,
                "is_active": True,
                "last_used_at": timezone.now(),
            },
        )
        return Response({"registered": True})

    def delete(self, request):
        token = (request.data.get("token") or "").strip()
        if token:
            DeviceToken.objects.filter(token=token, user=request.user).update(is_active=False)
        return Response({"deactivated": True})
