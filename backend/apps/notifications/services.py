"""
Notification service — main entry point for the rest of the codebase.

Anywhere you want to fire a notification:

    from apps.notifications.services import dispatch
    from apps.notifications.models import EventType

    dispatch(
        event_type=EventType.BOOKING_PAYMENT_SUCCEEDED,
        recipients=[user1, user2],
        context={"property_name": "...", ...},
        idempotency_event_id="payment_succeeded:<payment_id>",
    )

The function never raises — failures are logged and notifications are queued
for retry. Calling code is decoupled from delivery details.
"""

import hashlib
import logging
from datetime import timedelta
from typing import Iterable, List, Optional

from django.db import transaction
from django.template import Context, Template
from django.utils import timezone

from .models import (
    EventType,
    Notification,
    NotificationChannel,
    NotificationStatus,
    NotificationTemplate,
    UserNotificationPreference,
)

logger = logging.getLogger(__name__)

DEFAULT_CHANNELS = [
    NotificationChannel.EMAIL,
    NotificationChannel.SMS,
]


def dispatch(
    event_type: str,
    recipients: Iterable,
    context: dict,
    idempotency_event_id: Optional[str] = None,
    channels: Optional[List[str]] = None,
) -> None:
    """Queue notifications for the given event + recipients. Never raises."""
    if not recipients:
        return

    channels = channels or DEFAULT_CHANNELS

    for user in recipients:
        for channel in channels:
            try:
                _enqueue_one(
                    user=user,
                    event_type=event_type,
                    channel=channel,
                    context=context,
                    idempotency_event_id=idempotency_event_id,
                )
            except Exception as e:
                logger.exception(
                    f"Failed to enqueue notification "
                    f"(user={user.id}, event={event_type}, channel={channel}): {e}"
                )


def _enqueue_one(
    user,
    event_type: str,
    channel: str,
    context: dict,
    idempotency_event_id: Optional[str],
) -> None:
    if not _user_wants_channel(user, event_type, channel):
        logger.debug(f"User {user.id} opted out of {event_type}/{channel}")
        return

    recipient_address = _resolve_recipient_address(user, channel)
    if not recipient_address:
        logger.debug(f"User {user.id} has no {channel} address; skipping")
        return

    idem_seed = idempotency_event_id or f"{event_type}:{user.id}:{timezone.now().isoformat()}"
    idempotency_key = hashlib.sha256(
        f"{idem_seed}:{user.id}:{channel}".encode()
    ).hexdigest()[:32]

    try:
        template = NotificationTemplate.objects.get(
            event_type=event_type, channel=channel, is_active=True,
        )
    except NotificationTemplate.DoesNotExist:
        logger.warning(f"No active template for {event_type}/{channel}; skipping")
        return

    subject = _render(template.subject_template, context) if template.subject_template else ""
    body = _render(template.body_template, context)

    metadata: dict = {}
    if channel == NotificationChannel.SMS:
        # MSG91-specific extras come from the dispatch context
        metadata["msg91_flow_id"] = context.get("msg91_flow_id", "")
        metadata["msg91_variables"] = context.get("msg91_variables", {})

    with transaction.atomic():
        Notification.objects.update_or_create(
            idempotency_key=idempotency_key,
            channel=channel,
            defaults={
                "user": user,
                "event_type": event_type,
                "status": NotificationStatus.PENDING,
                "recipient_address": recipient_address,
                "subject": subject,
                "body": body,
                "payload": {**_safe_payload(context), "metadata": metadata},
                "next_attempt_at": timezone.now(),
            },
        )


def _user_wants_channel(user, event_type: str, channel: str) -> bool:
    pref = UserNotificationPreference.objects.filter(
        user=user, event_type=event_type, channel=channel,
    ).first()
    return True if pref is None else pref.enabled


def _resolve_recipient_address(user, channel: str) -> Optional[str]:
    """Map (user, channel) to the right address. Adapt to your User model."""
    if channel == NotificationChannel.EMAIL:
        return getattr(user, "email", None) or None
    if channel == NotificationChannel.SMS:
        cc = getattr(user, "phone_country_code", "") or ""
        num = getattr(user, "phone_number", "") or ""
        if num:
            return f"{cc}{num}".strip()
        return None
    if channel == NotificationChannel.PUSH:
        # implement once push tokens are stored
        return None
    return None


def _render(template_str: str, context: dict) -> str:
    return Template(template_str).render(Context(context))


def _safe_payload(context: dict) -> dict:
    """Strip non-JSON-serializable values from context before storing."""
    safe = {}
    for k, v in (context or {}).items():
        try:
            import json
            json.dumps(v)
            safe[k] = v
        except Exception:
            safe[k] = str(v)
    return safe


def schedule_retry(notification: Notification) -> None:
    """Exponential backoff: 1m, 5m, 15m, 1h, 4h."""
    notification.attempts += 1
    if notification.attempts >= notification.max_attempts:
        notification.status = NotificationStatus.DEAD
    else:
        backoff = [1, 5, 15, 60, 240][min(notification.attempts - 1, 4)]
        notification.next_attempt_at = timezone.now() + timedelta(minutes=backoff)
        notification.status = NotificationStatus.PENDING
    notification.save(update_fields=["attempts", "status", "next_attempt_at"])