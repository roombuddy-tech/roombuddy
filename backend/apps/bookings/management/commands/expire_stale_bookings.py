"""
Backup cleanup for stale pending bookings.

1. Payment-window expired: guest created booking but didn't complete payment.
2. Host-response expired:  guest paid but host didn't accept/reject within deadline.

Run via cron every 5 minutes:
    */5 * * * *  cd /path/to/backend && python manage.py expire_stale_bookings
"""
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.bookings.models import Booking, BookingStatusHistory
from apps.notifications.models import EventType
from apps.notifications.services import dispatch
from apps.payments.services import initiate_refund_for_cancelled_booking
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
            refund_amount = Decimal("0.00")

            with transaction.atomic():
                booking.status = Booking.Status.EXPIRED
                update_fields = ["status", "updated_at"]

                # The guest paid up front and the host never answered — they got
                # nothing for it, so the fee goes back in full. Without this the
                # notification below promises a refund that never arrives.
                if booking.payment_status == Booking.PaymentStatus.PAID:
                    refund_amount = booking.total_guest_pays or Decimal("0.00")
                    if refund_amount > 0:
                        booking.refund_amount = refund_amount
                        booking.payment_status = Booking.PaymentStatus.REFUND_PENDING
                        update_fields += ["refund_amount", "payment_status"]

                booking.save(update_fields=update_fields)

                BookingStatusHistory.objects.create(
                    booking=booking,
                    from_status=from_status,
                    to_status=Booking.Status.EXPIRED,
                    changed_by_user=None,
                    reason=StatusChangeReason.HOST_NO_RESPONSE,
                )

            # Gateway call outside the transaction, and guarded per booking so a
            # single failure can't abort the rest of the batch.
            if booking.payment_status == Booking.PaymentStatus.REFUND_PENDING:
                try:
                    initiate_refund_for_cancelled_booking(
                        booking, refund_amount, Booking.CancelledBy.SYSTEM,
                    )
                except Exception:
                    logger.exception(
                        "Auto-expire refund failed for %s — left REFUND_PENDING",
                        booking.booking_code,
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
                            "reason": (
                                f"The host did not respond within "
                                f"{settings.HOST_RESPONSE_DEADLINE_HOURS} hours. "
                                f"Your ₹{refund_amount:.0f} has been refunded and should "
                                f"reach you in 5–7 working days."
                            ),
                        },
                    )
                except Exception:
                    logger.exception("Failed to notify guest of auto-cancel %s", booking.booking_code)

            self.stdout.write(f"  Auto-cancelled {booking.booking_code} (host no response)")

        self.stdout.write(self.style.SUCCESS(f"Auto-cancelled {count} unresponded booking(s)"))
