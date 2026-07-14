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
from django.template.loader import render_to_string, TemplateDoesNotExist


from django.db import transaction
from django.template import Context, Template
from django.utils import timezone

from .models import (
    DeviceToken,
    EventType,
    Notification,
    NotificationChannel,
    NotificationStatus,
    NotificationTemplate,
    UserNotificationPreference,
)
import json

logger = logging.getLogger(__name__)

DEFAULT_CHANNELS = [
    NotificationChannel.EMAIL,
    NotificationChannel.SMS,
    NotificationChannel.PUSH,
    NotificationChannel.IN_APP,
]


def dispatch(
    event_type: str,
    recipients: Iterable,
    context: dict,
    idempotency_event_id: Optional[str] = None,
    channels: Optional[List[str]] = None,
) -> None:
    """Queue notifications for the given event + recipients. Never raises."""
    logger.info("dispatch event_type=%s idempotency_event_id=%s", event_type, idempotency_event_id)
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
    logger.info("_enqueue_one user_id=%s event_type=%s idempotency_event_id=%s", getattr(user, "id", None), event_type, idempotency_event_id)
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
        body = _render_file_template(event_type, channel, "html", context)
        subject = _render_file_template(event_type, channel, "subject", context).strip()
    except TemplateDoesNotExist:
        logger.warning(f"No file template for {event_type}/{channel}; skipping")
        return

    metadata: dict = {}
    if channel == NotificationChannel.SMS:
        # MSG91-specific extras come from the dispatch context
        metadata["msg91_flow_id"] = context.get("msg91_flow_id", "")
        metadata["msg91_variables"] = context.get("msg91_variables", {})
    if channel == NotificationChannel.PUSH:
        # Data the app reads on tap to deep-link to the right screen.
        metadata["push_data"] = {
            "event_type": event_type,
            "booking_id": context.get("booking_id", ""),
            "conversation_id": context.get("conversation_id", ""),
            "listing_id": context.get("listing_id", ""),
        }

    now = timezone.now()
    if channel == NotificationChannel.IN_APP:
        defaults = {
            "user": user,
            "event_type": event_type,
            "status": NotificationStatus.DELIVERED,
            "recipient_address": recipient_address,
            "subject": subject,
            "body": body,
            "payload": {**_safe_payload(context), "metadata": metadata},
            "next_attempt_at": now,
            "sent_at": now,
            "delivered_at": now,
            "read_at": None,
        }
    else:
        defaults = {
            "user": user,
            "event_type": event_type,
            "status": NotificationStatus.PENDING,
            "recipient_address": recipient_address,
            "subject": subject,
            "body": body,
            "payload": {**_safe_payload(context), "metadata": metadata},
            "next_attempt_at": now,
        }

    with transaction.atomic():
        Notification.objects.update_or_create(
            idempotency_key=idempotency_key,
            channel=channel,
            defaults=defaults,
        )

def _render_file_template(event_type: str, channel: str, kind: str, context: dict) -> str:
    """
    Convention: notifications/<event_underscored>/<channel>.<kind>

    Push reuses the in-app templates (same short title/body), so we don't
    duplicate a push.* file for every event.
    """
    event_path = event_type.replace(".", "_")
    template_channel = "in_app" if channel == NotificationChannel.PUSH else channel
    template_name = f"notifications/{event_path}/{template_channel}.{kind}"
    return render_to_string(template_name, context)

def _user_wants_channel(user, event_type: str, channel: str) -> bool:
    pref = UserNotificationPreference.objects.filter(
        user=user, event_type=event_type, channel=channel,
    ).first()
    return True if pref is None else pref.enabled


def _resolve_recipient_address(user, channel: str) -> Optional[str]:
    """Map (user, channel) to the right address. Adapt to your User model."""
    logger.info("_resolve_recipient_address user_id=%s", getattr(user, "id", None))
    if channel == NotificationChannel.EMAIL:
        return getattr(user, "email", None) or None
    if channel == NotificationChannel.SMS:
        cc = getattr(user, "phone_country_code", "") or ""
        num = getattr(user, "phone_number", "") or ""
        if num:
            return f"{cc}{num}".strip()
        return None
    if channel == NotificationChannel.IN_APP:
        return str(getattr(user, "id", "")) or None
    if channel == NotificationChannel.PUSH:
        # Send to the user's most-recently-registered active device.
        # (v0: one device per user is the common case.)
        token = (
            DeviceToken.objects
            .filter(user=user, is_active=True)
            .order_by("-updated_at")
            .values_list("token", flat=True)
            .first()
        )
        return token or None
    return None


def _render(template_str: str, context: dict) -> str:
    return Template(template_str).render(Context(context))


def _safe_payload(context: dict) -> dict:
    """Strip non-JSON-serializable values from context before storing."""
    safe = {}
    for k, v in (context or {}).items():
        try:
            json.dumps(v)
            safe[k] = v
        except Exception:
            logger.exception("_safe_payload failed")
            safe[k] = str(v)
    return safe


def schedule_retry(notification: Notification) -> None:
    """Exponential backoff: 1m, 5m, 15m, 1h, 4h."""
    logger.info("schedule_retry notification_id=%s", getattr(notification, "id", None))
    notification.attempts += 1
    if notification.attempts >= notification.max_attempts:
        notification.status = NotificationStatus.DEAD
    else:
        backoff = [1, 5, 15, 60, 240][min(notification.attempts - 1, 4)]
        notification.next_attempt_at = timezone.now() + timedelta(minutes=backoff)
        notification.status = NotificationStatus.PENDING
    notification.save(update_fields=["attempts", "status", "next_attempt_at"])