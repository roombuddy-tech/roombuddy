import uuid

from django.db import models
from django.utils import timezone


class NotificationChannel(models.TextChoices):
    EMAIL = "email", "Email"
    SMS = "sms", "SMS"
    PUSH = "push", "Push"
    # WHATSAPP = "whatsapp", "WhatsApp"  # phase 2


class NotificationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SENDING = "sending", "Sending"
    SENT = "sent", "Sent"
    DELIVERED = "delivered", "Delivered"
    FAILED = "failed", "Failed"
    DEAD = "dead", "Dead"  # exhausted retries
    SKIPPED = "skipped", "Skipped"  # user opted out


class EventType(models.TextChoices):
    """All recognized notification events. Add new ones here as needed."""
    BOOKING_PAYMENT_SUCCEEDED = "booking.payment_succeeded", "Booking payment succeeded"
    BOOKING_PAYMENT_FAILED = "booking.payment_failed", "Booking payment failed"
    BOOKING_HOST_ACCEPTED = "booking.host_accepted", "Host accepted booking"
    BOOKING_HOST_REJECTED = "booking.host_rejected", "Host rejected booking"
    BOOKING_GUEST_CANCELLED = "booking.guest_cancelled", "Guest cancelled booking"
    BOOKING_HOST_CANCELLED = "booking.host_cancelled", "Host cancelled booking"
    BOOKING_REFUND_INITIATED = "booking.refund_initiated", "Refund initiated"
    BOOKING_REFUND_COMPLETED = "booking.refund_completed", "Refund completed"


class NotificationTemplate(models.Model):
    """Per-channel template for a given event type.

    The template engine is Django Templates. Variables come from the
    `context` dict passed to `dispatch()`. Same context is shared across
    channels for a given event, so write templates that use the same vars.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=64, choices=EventType.choices)
    channel = models.CharField(max_length=16, choices=NotificationChannel.choices)
    subject_template = models.CharField(
        max_length=255,
        blank=True,
        help_text="Used for email only; SMS ignores this.",
    )
    body_template = models.TextField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notification_templates"
        constraints = [
            models.UniqueConstraint(
                fields=["event_type", "channel"],
                name="uq_notif_template_event_channel",
            ),
        ]
        indexes = [
            models.Index(
                fields=["event_type", "channel"],
                name="idx_notif_template_lookup",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.event_type} / {self.channel}"


class Notification(models.Model):
    """A single dispatch attempt for one (recipient, event, channel) tuple.

    Rendered subject/body are snapshotted at queue time so that template
    edits or context changes don't retroactively alter what was sent.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    event_type = models.CharField(max_length=64, choices=EventType.choices)
    channel = models.CharField(max_length=16, choices=NotificationChannel.choices)
    status = models.CharField(
        max_length=16,
        choices=NotificationStatus.choices,
        default=NotificationStatus.PENDING,
    )

    # Rendered content — snapshot at enqueue time
    recipient_address = models.CharField(
        max_length=255,
        help_text="Email, phone (with country code), or push token.",
    )
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField()

    # Original context dict (for debugging/audit)
    payload = models.JSONField(default=dict, blank=True)

    idempotency_key = models.CharField(max_length=128, db_index=True)

    # Provider tracking
    provider_message_id = models.CharField(max_length=255, blank=True)
    last_error = models.TextField(blank=True)

    # Retries
    attempts = models.IntegerField(default=0)
    max_attempts = models.IntegerField(default=5)
    next_attempt_at = models.DateTimeField(default=timezone.now, db_index=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    # In-app feed visibility
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "notifications"
        constraints = [
            models.UniqueConstraint(
                fields=["idempotency_key", "channel"],
                name="uq_notif_idem_channel",
            ),
        ]
        indexes = [
            models.Index(
                fields=["status", "next_attempt_at"],
                name="idx_notif_status_next",
            ),
            models.Index(
                fields=["user", "-created_at"],
                name="idx_notif_user_created",
            ),
            models.Index(
                fields=["user", "read_at"],
                name="idx_notif_user_read",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.event_type} → user {self.user_id} via {self.channel} "
            f"({self.status})"
        )


class UserNotificationPreference(models.Model):
    """Per-user opt-in/opt-out for (event, channel) combinations.

    Default is opted-in for everything — a row only exists when the user
    has explicitly toggled a preference. Absence of a row = enabled.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    event_type = models.CharField(max_length=64, choices=EventType.choices)
    channel = models.CharField(max_length=16, choices=NotificationChannel.choices)
    enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_notification_preferences"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "event_type", "channel"],
                name="uq_notif_pref_user_event_channel",
            ),
        ]
        indexes = [
            models.Index(
                fields=["user", "event_type", "channel"],
                name="idx_notif_pref_lookup",
            ),
        ]

    def __str__(self) -> str:
        state = "on" if self.enabled else "off"
        return f"user {self.user_id} {self.event_type}/{self.channel}: {state}"