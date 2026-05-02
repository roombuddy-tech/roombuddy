"""
Backup cleanup for stale pending bookings.

When a guest creates a booking but doesn't complete payment within the window
(`PAYMENT_WINDOW_MINUTES`), the booking sits in PENDING with an expired
`expires_at` timestamp.

Even though `_has_overlap` correctly ignores stale bookings when checking
availability, the database row's status field still says "pending". This
command flips them to "expired" so:

1. Admin dashboards show clean state
2. Hosts don't see phantom pending bookings
3. Reports/analytics work correctly

Run via cron every 5 minutes:
    */5 * * * *  cd /path/to/backend && python manage.py expire_stale_bookings

Or manually for testing:
    python manage.py expire_stale_bookings
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.bookings.models import Booking, BookingStatusHistory
from common.constants import StatusChangeReason


class Command(BaseCommand):
    help = "Mark stale pending bookings as EXPIRED (payment window passed)"

    def handle(self, *args, **opts):
        now = timezone.now()

        # Find bookings that:
        # - are still in PENDING state
        # - have a payment_pending status
        # - have an expires_at in the past
        stale = Booking.objects.filter(
            status=Booking.Status.PENDING,
            payment_status=Booking.PaymentStatus.PAYMENT_PENDING,
            expires_at__lt=now,
        )

        count = stale.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS("✅ Expired 0 stale booking(s)"))
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

            self.stdout.write(
                f"  Expired {booking.booking_code} "
                f"(created {booking.created_at.strftime('%Y-%m-%d %H:%M')})"
            )

        self.stdout.write(self.style.SUCCESS(f"\n✅ Expired {count} stale booking(s)"))
