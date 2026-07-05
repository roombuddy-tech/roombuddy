"""
Advance confirmed bookings through their date-driven lifecycle.

A booking the host has accepted (and the guest has paid) stays `accepted` until
its dates arrive. This command moves it along as time passes:

  accepted  --(check-in reached)-->  active
  active    --(check-out passed)-->  completed

This keeps the host's Active/Upcoming/Completed sections, the status badge, and
earnings (which count active/completed) all consistent without manual admin work.

Run via cron once a day (a few minutes after midnight, host timezone):
    5 0 * * *  cd /path/to/backend && python manage.py advance_booking_lifecycle

Running it more often is harmless — it's idempotent.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.bookings.models import Booking, BookingStatusHistory
from common.constants import StatusChangeReason
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Auto-activate bookings on check-in and auto-complete them after check-out"

    def handle(self, *args, **opts):
        today = timezone.localdate()
        self._activate(today)
        self._complete(today)

    def _activate(self, today):
        # Accepted + paid, and today falls within the stay.
        due = Booking.objects.filter(
            status=Booking.Status.ACCEPTED,
            payment_status=Booking.PaymentStatus.PAID,
            check_in_date__lte=today,
            check_out_date__gte=today,
        )

        count = 0
        for booking in due:
            from_status = booking.status
            booking.status = Booking.Status.ACTIVE
            booking.save(update_fields=["status", "updated_at"])
            BookingStatusHistory.objects.create(
                booking=booking,
                from_status=from_status,
                to_status=Booking.Status.ACTIVE,
                changed_by_user=None,
                reason=StatusChangeReason.STAY_STARTED,
            )
            count += 1
            self.stdout.write(f"  Activated {booking.booking_code}")

        self.stdout.write(self.style.SUCCESS(f"Activated {count} booking(s)"))

    def _complete(self, today):
        # Any confirmed stay whose check-out day has passed.
        due = Booking.objects.filter(
            status__in=(Booking.Status.ACTIVE, Booking.Status.ACCEPTED),
            payment_status=Booking.PaymentStatus.PAID,
            check_out_date__lt=today,
        )

        count = 0
        for booking in due:
            from_status = booking.status
            booking.status = Booking.Status.COMPLETED
            booking.save(update_fields=["status", "updated_at"])
            BookingStatusHistory.objects.create(
                booking=booking,
                from_status=from_status,
                to_status=Booking.Status.COMPLETED,
                changed_by_user=None,
                reason=StatusChangeReason.STAY_COMPLETED,
            )
            count += 1
            self.stdout.write(f"  Completed {booking.booking_code}")

        self.stdout.write(self.style.SUCCESS(f"Completed {count} booking(s)"))
