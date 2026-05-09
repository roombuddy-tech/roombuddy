"""Long-running worker — picks notifications off the queue and dispatches them.

Run via systemd:
  python manage.py run_notification_worker --interval 5

Or one-shot for testing:
  python manage.py run_notification_worker --once
"""

import logging
import time

from django.core.management.base import BaseCommand

from apps.notifications.dispatcher import dispatch_pending

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Long-running notification dispatcher."

    def add_arguments(self, parser):
        parser.add_argument(
            "--interval", type=int, default=5,
            help="Seconds between empty polls (default 5)",
        )
        parser.add_argument(
            "--once", action="store_true",
            help="Run one batch and exit",
        )

    def handle(self, *args, **opts):
        interval = opts["interval"]
        once = opts["once"]

        self.stdout.write(self.style.SUCCESS(
            f"Notification worker starting (interval={interval}s, once={once})"
        ))

        while True:
            try:
                count = dispatch_pending()
                if count > 0:
                    self.stdout.write(f"Dispatched {count} notifications")
                if once:
                    break
                if count == 0:
                    time.sleep(interval)
            except KeyboardInterrupt:
                self.stdout.write(self.style.WARNING("Worker stopped by user"))
                break
            except Exception as e:
                logger.exception(f"Worker loop error: {e}")
                time.sleep(interval)