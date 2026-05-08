"""Worker that picks pending notifications off the DB queue and dispatches them."""

import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import Notification, NotificationStatus
from .providers import get_provider
from .services import schedule_retry

logger = logging.getLogger(__name__)

BATCH_SIZE = 50
SENDING_LOCK_TIMEOUT = timedelta(minutes=5)


def dispatch_pending() -> int:
    """Process one batch of pending notifications. Returns count processed."""
    now = timezone.now()
    stale_cutoff = now - SENDING_LOCK_TIMEOUT

    with transaction.atomic():
        # Reclaim notifications stuck in SENDING (worker crashed mid-dispatch)
        Notification.objects.filter(
            status=NotificationStatus.SENDING,
            next_attempt_at__lt=stale_cutoff,
        ).update(status=NotificationStatus.PENDING)

        # Pick up a batch (skip rows another worker has locked)
        candidates = list(
            Notification.objects
            .select_for_update(skip_locked=True)
            .filter(status=NotificationStatus.PENDING, next_attempt_at__lte=now)
            .order_by("next_attempt_at")[:BATCH_SIZE]
        )

        if not candidates:
            return 0

        ids = [n.id for n in candidates]
        Notification.objects.filter(id__in=ids).update(status=NotificationStatus.SENDING)

    # Dispatch outside the transaction so HTTP calls don't hold row locks
    processed = 0
    for n in candidates:
        try:
            _send_one(n)
            processed += 1
        except Exception as e:
            logger.exception(f"Worker error on notification {n.id}: {e}")
            n.last_error = str(e)[:1000]
            n.save(update_fields=["last_error"])
            schedule_retry(n)

    return processed


def _send_one(notification: Notification) -> None:
    provider = get_provider(notification.channel)
    metadata = (notification.payload or {}).get("metadata", {}) or {}

    result = provider.send(
        recipient=notification.recipient_address,
        subject=notification.subject,
        body=notification.body,
        metadata=metadata,
    )

    if result.success:
        notification.status = NotificationStatus.SENT
        notification.sent_at = timezone.now()
        notification.provider_message_id = result.provider_message_id or ""
        notification.last_error = ""
        notification.save(update_fields=[
            "status", "sent_at", "provider_message_id", "last_error",
        ])
        logger.info(
            f"Sent notification {notification.id} ({notification.channel}) "
            f"to {notification.recipient_address}"
        )
        return

    notification.last_error = (result.error or "")[:1000]
    if not result.is_retriable:
        notification.status = NotificationStatus.DEAD
        notification.save(update_fields=["status", "last_error"])
        logger.warning(
            f"Notification {notification.id} dead (non-retriable): {result.error}"
        )
        return

    schedule_retry(notification)
    logger.info(
        f"Notification {notification.id} retry scheduled "
        f"(attempt {notification.attempts}/{notification.max_attempts})"
    )