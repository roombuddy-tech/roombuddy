from django.contrib import admin

from .models import Notification, NotificationTemplate, UserNotificationPreference
import logging

logger = logging.getLogger(__name__)


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ("event_type", "channel", "is_active", "updated_at")
    list_filter = ("channel", "is_active", "event_type")
    search_fields = ("event_type", "body_template")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "id", "user", "event_type", "channel",
        "status", "attempts", "created_at", "sent_at",
    )
    list_filter = ("status", "channel", "event_type")
    search_fields = (
        "user__email", "user__phone_number",
        "recipient_address", "idempotency_key", "provider_message_id",
    )
    readonly_fields = (
        "id", "idempotency_key", "provider_message_id",
        "created_at", "sent_at", "delivered_at",
    )
    date_hierarchy = "created_at"


@admin.register(UserNotificationPreference)
class UserNotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ("user", "event_type", "channel", "enabled", "updated_at")
    list_filter = ("channel", "enabled", "event_type")
    search_fields = ("user__email", "user__phone_number")
    readonly_fields = ("id", "updated_at")