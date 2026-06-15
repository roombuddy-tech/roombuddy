import logging

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.conversations.models import Conversation, Message
from common.utils import get_display_name, get_initials
from apps.notifications.models import EventType, NotificationChannel
from apps.notifications.services import dispatch

logger = logging.getLogger(__name__)

MESSAGE_PAGE_SIZE = 50
MESSAGE_MAX_LENGTH = 2000


def is_participant(conversation, user) -> bool:
    return user.id in (conversation.guest_user_id, conversation.host_user_id)


def get_or_create_conversation(booking) -> Conversation:
    conversation, _ = Conversation.objects.get_or_create(
        booking=booking,
        defaults={
            "guest_user_id": booking.guest_user_id,
            "host_user_id": booking.host_user_id,
        },
    )
    return conversation


def _counterpart(conversation, user):
    if user.id == conversation.guest_user_id:
        return conversation.host_user
    return conversation.guest_user


def _last_read_for(conversation, user):
    if user.id == conversation.guest_user_id:
        return conversation.guest_last_read_at
    return conversation.host_last_read_at


def unread_count(conversation, user) -> int:
    last_read = _last_read_for(conversation, user)
    qs = Message.objects.filter(conversation=conversation).exclude(sender_user_id=user.id)
    if last_read is not None:
        qs = qs.filter(created_at__gt=last_read)
    return qs.count()


def serialize_message(message, user) -> dict:
    return {
        "id": str(message.id),
        "body": message.body,
        "sender_id": str(message.sender_user_id),
        "is_mine": message.sender_user_id == user.id,
        "created_at": message.created_at.isoformat(),
    }


def serialize_conversation(conversation, user, *, last_message=None) -> dict:
    other = _counterpart(conversation, user)
    listing = conversation.booking.listing
    if last_message is None:
        last_message = (
            Message.objects.filter(conversation=conversation)
            .order_by("-created_at")
            .first()
        )
    return {
        "conversation_id": str(conversation.id),
        "booking_id": str(conversation.booking_id),
        "booking_code": conversation.booking.booking_code,
        "listing_title": listing.title if listing else None,
        "counterpart_name": get_display_name(other),
        "counterpart_initials": get_initials(other),
        "last_message": last_message.body if last_message else None,
        "last_message_at": (
            conversation.last_message_at.isoformat()
            if conversation.last_message_at else None
        ),
        "unread_count": unread_count(conversation, user),
    }


def list_conversations(user) -> list:
    conversations = (
        Conversation.objects
        .filter(Q(guest_user=user) | Q(host_user=user))
        .filter(last_message_at__isnull=False)
        .select_related("booking__listing", "guest_user__profile", "host_user__profile")
        .order_by("-last_message_at")
    )
    return [serialize_conversation(c, user) for c in conversations]


def get_messages(conversation, user, *, after=None) -> list:
    base = Message.objects.filter(conversation=conversation)
    if after:
        parsed = parse_datetime(after)
        if parsed is not None:
            if timezone.is_naive(parsed):
                parsed = timezone.make_aware(parsed)
            base = base.filter(created_at__gt=parsed)
        messages = list(base.order_by("created_at"))
    else:
        recent = list(base.order_by("-created_at")[:MESSAGE_PAGE_SIZE])
        messages = list(reversed(recent))
    return [serialize_message(m, user) for m in messages]


@transaction.atomic
def create_message(conversation, sender, body: str) -> Message:
    logger.info("create_message conversation_id=%s sender_id=%s", getattr(conversation, "id", None), getattr(sender, "id", None))
    message = Message.objects.create(
        conversation=conversation, sender_user=sender, body=body,
    )
    now = message.created_at
    update_fields = ["last_message_at", "updated_at"]
    conversation.last_message_at = now
    if sender.id == conversation.guest_user_id:
        conversation.guest_last_read_at = now
        update_fields.append("guest_last_read_at")
    else:
        conversation.host_last_read_at = now
        update_fields.append("host_last_read_at")
    conversation.save(update_fields=update_fields)
    _notify_new_message(conversation, sender, message)
    return message


def mark_read(conversation, user) -> None:
    logger.info("mark_read conversation_id=%s user_id=%s", getattr(conversation, "id", None), getattr(user, "id", None))
    now = timezone.now()
    if user.id == conversation.guest_user_id:
        conversation.guest_last_read_at = now
        conversation.save(update_fields=["guest_last_read_at", "updated_at"])
    else:
        conversation.host_last_read_at = now
        conversation.save(update_fields=["host_last_read_at", "updated_at"])

def _notify_new_message(conversation, sender, message) -> None:
    recipient = (
        conversation.host_user
        if sender.id == conversation.guest_user_id
        else conversation.guest_user
    )
    if recipient is None:
        return
    try:
        listing_title = conversation.booking.listing.title
    except Exception:
        logger.exception("_notify_new_message failed")
        listing_title = None
    dispatch(
        event_type=EventType.MESSAGE_RECEIVED,
        recipients=[recipient],
        context={
            "sender_name": get_display_name(sender),
            "conversation_id": str(conversation.id),
            "listing_title": listing_title or "",
        },
        idempotency_event_id=f"message:{conversation.id}:{recipient.id}",
        channels=[NotificationChannel.IN_APP],
    )
