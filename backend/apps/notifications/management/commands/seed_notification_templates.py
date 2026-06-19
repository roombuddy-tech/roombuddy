from django.core.management.base import BaseCommand

from apps.notifications.models import EventType, NotificationChannel, NotificationTemplate
import logging

logger = logging.getLogger(__name__)


TEMPLATES = [
    # ── Payment succeeded ──────────────────────────────────────────────────
    {
        "event_type": EventType.BOOKING_PAYMENT_SUCCEEDED,
        "channel": NotificationChannel.EMAIL,
        "subject_template": "Booking confirmed: {{ property_name }}",
        "body_template": (
            "<p>Hi {{ recipient_name }},</p>"
            "<p>Your booking is confirmed.</p>"
            "<ul>"
            "<li><strong>Property:</strong> {{ property_name }}</li>"
            "<li><strong>Booking ID:</strong> {{ booking_reference }}</li>"
            "<li><strong>Check-in:</strong> {{ check_in }}</li>"
            "<li><strong>Check-out:</strong> {{ check_out }}</li>"
            "<li><strong>Amount paid:</strong> ₹{{ amount }}</li>"
            "</ul>"
            "<p>— The RoomBuddy team</p>"
        ),
    },
    {
        "event_type": EventType.BOOKING_PAYMENT_SUCCEEDED,
        "channel": NotificationChannel.SMS,
        "subject_template": "",
        "body_template": (
            "RoomBuddy: Booking {{ booking_reference }} confirmed for "
            "{{ property_name }} ({{ check_in }} to {{ check_out }}). "
            "Amount Rs.{{ amount }}."
        ),
    },
    # ── Payment failed ─────────────────────────────────────────────────────
    {
        "event_type": EventType.BOOKING_PAYMENT_FAILED,
        "channel": NotificationChannel.EMAIL,
        "subject_template": "Payment failed for booking {{ booking_reference }}",
        "body_template": (
            "<p>Hi {{ recipient_name }},</p>"
            "<p>Your payment for booking <strong>{{ property_name }}</strong> "
            "did not go through.</p>"
            "<p>You can retry the payment from the app.</p>"
            "<p>— The RoomBuddy team</p>"
        ),
    },
    {
        "event_type": EventType.BOOKING_PAYMENT_FAILED,
        "channel": NotificationChannel.SMS,
        "subject_template": "",
        "body_template": (
            "RoomBuddy: Payment failed for booking {{ booking_reference }}. "
            "Please retry from the app."
        ),
    },
    # ── Host accepted ──────────────────────────────────────────────────────
    {
        "event_type": EventType.BOOKING_HOST_ACCEPTED,
        "channel": NotificationChannel.EMAIL,
        "subject_template": "Booking accepted: {{ property_name }}",
        "body_template": (
            "<p>Hi {{ recipient_name }},</p>"
            "<p>Your host has accepted your booking for "
            "<strong>{{ property_name }}</strong>.</p>"
            "<p>Booking ID: {{ booking_reference }}</p>"
            "<p>— The RoomBuddy team</p>"
        ),
    },
    {
        "event_type": EventType.BOOKING_HOST_ACCEPTED,
        "channel": NotificationChannel.SMS,
        "subject_template": "",
        "body_template": (
            "RoomBuddy: Booking {{ booking_reference }} accepted by host. "
            "Check the app for details."
        ),
    },
    # ── Host rejected ──────────────────────────────────────────────────────
    {
        "event_type": EventType.BOOKING_HOST_REJECTED,
        "channel": NotificationChannel.EMAIL,
        "subject_template": "Booking declined: {{ property_name }}",
        "body_template": (
            "<p>Hi {{ recipient_name }},</p>"
            "<p>Unfortunately, the host declined your booking for "
            "<strong>{{ property_name }}</strong>.</p>"
            "<p>Any payment will be refunded automatically.</p>"
            "<p>— The RoomBuddy team</p>"
        ),
    },
    {
        "event_type": EventType.BOOKING_HOST_REJECTED,
        "channel": NotificationChannel.SMS,
        "subject_template": "",
        "body_template": (
            "RoomBuddy: Booking {{ booking_reference }} declined. "
            "Refund will be processed shortly."
        ),
    },
    # ── Guest cancelled ────────────────────────────────────────────────────
    {
        "event_type": EventType.BOOKING_GUEST_CANCELLED,
        "channel": NotificationChannel.EMAIL,
        "subject_template": "Booking cancelled: {{ property_name }}",
        "body_template": (
            "<p>Hi {{ recipient_name }},</p>"
            "<p>The booking for <strong>{{ property_name }}</strong> "
            "was cancelled by the guest.</p>"
            "<p>Booking ID: {{ booking_reference }}</p>"
            "<p>— The RoomBuddy team</p>"
        ),
    },
    {
        "event_type": EventType.BOOKING_GUEST_CANCELLED,
        "channel": NotificationChannel.SMS,
        "subject_template": "",
        "body_template": "RoomBuddy: Booking {{ booking_reference }} cancelled by guest.",
    },
    # ── Host cancelled ─────────────────────────────────────────────────────
    {
        "event_type": EventType.BOOKING_HOST_CANCELLED,
        "channel": NotificationChannel.EMAIL,
        "subject_template": "Booking cancelled by host: {{ property_name }}",
        "body_template": (
            "<p>Hi {{ recipient_name }},</p>"
            "<p>Your booking for <strong>{{ property_name }}</strong> "
            "was cancelled by the host.</p>"
            "<p>Any payment will be refunded automatically.</p>"
            "<p>— The RoomBuddy team</p>"
        ),
    },
    {
        "event_type": EventType.BOOKING_HOST_CANCELLED,
        "channel": NotificationChannel.SMS,
        "subject_template": "",
        "body_template": (
            "RoomBuddy: Booking {{ booking_reference }} cancelled by host. "
            "Refund will be processed."
        ),
    },
    # ── Refund completed ───────────────────────────────────────────────────
    {
        "event_type": EventType.BOOKING_REFUND_COMPLETED,
        "channel": NotificationChannel.EMAIL,
        "subject_template": "Refund processed for {{ booking_reference }}",
        "body_template": (
            "<p>Hi {{ recipient_name }},</p>"
            "<p>Your refund of ₹{{ amount }} for booking "
            "{{ booking_reference }} has been processed.</p>"
            "<p>It should reflect in your account within 5–7 business days.</p>"
            "<p>— The RoomBuddy team</p>"
        ),
    },
    {
        "event_type": EventType.BOOKING_REFUND_COMPLETED,
        "channel": NotificationChannel.SMS,
        "subject_template": "",
        "body_template": (
            "RoomBuddy: Refund of Rs.{{ amount }} for {{ booking_reference }} "
            "processed. 5-7 days to reflect."
        ),
    },
]


class Command(BaseCommand):
    help = "Seed notification templates (idempotent)."

    def handle(self, *args, **opts):
        created, updated = 0, 0
        for tpl in TEMPLATES:
            _, was_created = NotificationTemplate.objects.update_or_create(
                event_type=tpl["event_type"],
                channel=tpl["channel"],
                defaults={
                    "subject_template": tpl["subject_template"],
                    "body_template": tpl["body_template"],
                    "is_active": True,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1
        self.stdout.write(self.style.SUCCESS(
            f"Templates: {created} created, {updated} updated"
        ))