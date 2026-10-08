"""
Snooze temporary listings whose availability window has ended, and tell the
host once (email + in-app + push) that they can extend the dates or create a
new listing.

"Ended" means available_until is today or earlier — the same cutoff search
uses to hide them. Each listing is notified once per end date, tracked via
term_ended_notified_for, so re-runs (and a host un-snoozing without changing
dates) never send a second notice.

Run via cron every 5 minutes (see scripts/run_scheduled_jobs.sh):
    python manage.py end_expired_temporary_listings
"""
import logging

from django.core.management.base import BaseCommand
from django.db.models import F, Q
from django.utils import timezone

from apps.bookings.services import _user_first_name
from apps.listings.models import Listing
from apps.notifications.models import EventType, NotificationChannel
from apps.notifications.services import dispatch

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Snooze temporary listings past their available-until date and notify the host once"

    def handle(self, *args, **opts):
        today = timezone.localdate()
        ended = (
            Listing.objects
            .filter(
                status=Listing.Status.LIVE,
                listing_term=Listing.ListingTerm.TEMPORARY,
                available_until__lte=today,
            )
            # Skip anything already notified for this exact end date.
            .filter(Q(term_ended_notified_for__isnull=True) | ~Q(term_ended_notified_for=F("available_until")))
            .select_related("host_user__profile")
        )

        count = 0
        for listing in ended:
            listing.status = Listing.Status.SNOOZED
            listing.term_ended_notified_for = listing.available_until
            listing.save(update_fields=["status", "term_ended_notified_for"])
            count += 1

            try:
                dispatch(
                    event_type=EventType.LISTING_TERM_ENDED,
                    recipients=[listing.host_user],
                    context={
                        "property_name": listing.title,
                        "recipient_name": _user_first_name(listing.host_user),
                        "available_until": f"{listing.available_until:%d %b %Y}",
                        "listing_id": str(listing.id),
                    },
                    idempotency_event_id=f"listing_term_ended:{listing.id}:{listing.available_until.isoformat()}",
                    channels=[NotificationChannel.EMAIL, NotificationChannel.IN_APP, NotificationChannel.PUSH],
                )
            except Exception:
                logger.exception("Failed to notify host of ended listing %s", listing.id)

            self.stdout.write(f"  Snoozed ended temporary listing {listing.id}")

        self.stdout.write(self.style.SUCCESS(f"Snoozed {count} ended temporary listing(s)"))
