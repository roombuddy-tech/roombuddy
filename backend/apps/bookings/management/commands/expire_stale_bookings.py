"""
Backup cleanup for stale pending bookings.

1. Payment-window expired: guest created booking but didn't complete payment.
2. Host-response expired:  guest paid but host didn't accept/reject within deadline.

Run via cron every 5 minutes:
    */5 * * * *  cd /path/to/backend && python manage.py expire_stale_bookings
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.bookings.models import Booking, BookingStatusHistory
from apps.notifications.models import EventType
from apps.notifications.services import dispatch
from common.constants import StatusChangeReason
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Mark stale pending bookings as EXPIRED and auto-cancel unresponded bookings"

    def handle(self, *args, **opts):
        now = timezone.now()
        self._expire_unpaid(now)
        self._expire_host_no_response(now)

    def _expire_unpaid(self, now):
        stale = Booking.objects.filter(
            status=Booking.Status.PENDING,
            payment_status__in=[
                Booking.PaymentStatus.PAYMENT_PENDING,
                Booking.PaymentStatus.UNPAID,
            ],
            expires_at__lt=now,
        )

        count = stale.count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS("Expired 0 unpaid booking(s)"))
            return

        for booking in stale:
            from_status = booking.status
            booking.status = Booking.Status.EXPIRED
            booking.payment_status = Booking.PaymentStatus.FAILED
            booking.save(update_fields=["status", "payment_status", "updated_at"])

            BookingStatusHistory.objects.create(
                booking=booking,
                from_status=from_status,
                to_status=Booking.Status.EXPIRED,
                changed_by_user=None,
                reason=StatusChangeReason.PAYMENT_WINDOW_EXPIRED,
            )
            self.stdout.write(f"  Expired unpaid {booking.booking_code}")

        self.stdout.write(self.style.SUCCESS(f"Expired {count} unpaid booking(s)"))

    def _expire_host_no_response(self, now):
        unresponded = Booking.objects.filter(
            status=Booking.Status.PENDING,
            payment_status=Booking.PaymentStatus.PAID,
            host_responded_at__isnull=True,
            host_response_deadline__lt=now,
        )

        count = unresponded.count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS("Auto-cancelled 0 unresponded booking(s)"))
            return

        for booking in unresponded:
            from_status = booking.status
            booking.status = Booking.Status.EXPIRED
            booking.save(update_fields=["status", "updated_at"])

            BookingStatusHistory.objects.create(
                booking=booking,
                from_status=from_status,
                to_status=Booking.Status.EXPIRED,
                changed_by_user=None,
                reason=StatusChangeReason.HOST_NO_RESPONSE,
            )

            if booking.guest_user:
                try:
                    dispatch(
                        event_type=EventType.BOOKING_HOST_REJECTED,
                        recipients=[booking.guest_user],
                        context={
                            "property_name": booking.listing.title if booking.listing else "",
                            "recipient_name": (
                                booking.guest_name.split()[0] if booking.guest_name else "there"
                            ),
                            "reason": "The host did not respond within 24 hours. Your payment will be refunded.",
                        },
                    )
                except Exception:
                    logger.exception("Failed to notify guest of auto-cancel %s", booking.booking_code)

            self.stdout.write(f"  Auto-cancelled {booking.booking_code} (host no response)")

        self.stdout.write(self.style.SUCCESS(f"Auto-cancelled {count} unresponded booking(s)"))
