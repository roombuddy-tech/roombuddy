"""
Payment service.

Public API used by views and bookings service:
- create_order_for_booking()              : creates a Razorpay order, opens payment window
- verify_and_capture()                    : verifies signature post-checkout (sync path)
- handle_webhook()                        : processes async events from Razorpay
- initiate_refund_for_cancelled_booking() : kicks off a refund

Phase 1: no Razorpay Route. Money lands in RoomBuddy's gateway account and is
paid to hosts manually. When you switch to Phase 2, extend `create_order` to
include `transfers=[...]`.
"""
import logging
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.bookings.models import Booking, BookingStatusHistory
from apps.payments.models import ContactUnlock, Payment, Refund, WebhookEvent, WebhookEventType
from common.constants import StatusChangeReason
from apps.notifications.models import EventType
from apps.notifications.services import dispatch
from common.error_codes import ErrorCode
from common.redis_utils import idempotency_seen
from third_party import razorpay as rzp
from apps.properties.models import PropertyPhoto
from third_party.pdf_bill import generate_booking_invoice
from apps.notifications.providers.ses_email import SESEmailProvider
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


# Maps the cancelled_by value (Booking.CancelledBy) to the corresponding
# Refund.Reason.
_REFUND_REASON_BY_CANCELLER = {
    Booking.CancelledBy.GUEST: Refund.Reason.GUEST_CANCEL,
    Booking.CancelledBy.HOST: Refund.Reason.HOST_CANCEL,
    Booking.CancelledBy.SYSTEM: Refund.Reason.AUTO_EXPIRE,
}

# Set of valid Payment.Method values for fast membership checks
_VALID_PAYMENT_METHODS = set(Payment.Method.values)


# ─── Order creation (called when guest is ready to pay) ──────────────────

def create_order_for_booking(booking: Booking) -> dict:
    """
    Creates a Razorpay order for the booking with the configured payment window.
    Sets `booking.expires_at` so abandoned bookings auto-free their dates.
    """
    logger.info("create_order_for_booking booking_id=%s", getattr(booking, "id", None))
    if booking.status not in (Booking.Status.PENDING, Booking.Status.ACCEPTED):
        raise ValidationError({
            "error": "Booking is not in a payable state",
            "code": ErrorCode.INVALID_STATE,
        })

    if booking.payment_status == Booking.PaymentStatus.PAID:
        raise ValidationError({
            "error": "Booking is already paid",
            "code": ErrorCode.ALREADY_PAID,
        })

    existing = booking.payments.exclude(status=Payment.Status.FAILED).first()
    if existing and existing.status == Payment.Status.CAPTURED:
        raise ValidationError({
            "error": "Booking is already paid",
            "code": ErrorCode.ALREADY_PAID,
        })

    notes = {
        "booking_code": booking.booking_code,
        "booking_id": str(booking.id),
        "guest_id": str(booking.guest_user_id),
        "host_id": str(booking.host_user_id),
    }

    try:
        order = rzp.create_order(
            amount=booking.total_guest_pays,
            currency=booking.currency,
            receipt=booking.booking_code,
            notes=notes,
            expire_in_minutes=settings.PAYMENT_WINDOW_MINUTES,
        )
    except Exception as e:
        logger.error(f"Failed to create Razorpay order for {booking.booking_code}: {e}")
        raise ValidationError({
            "error": "Could not create payment order",
            "code": ErrorCode.GATEWAY_ERROR,
        })

    with transaction.atomic():
        Payment.objects.create(
            booking=booking,
            razorpay_order_id=order["id"],
            amount=booking.total_guest_pays,
            currency=booking.currency,
            status=Payment.Status.CREATED,
            raw_response=order,
        )
        booking.payment_status = Booking.PaymentStatus.PAYMENT_PENDING
        booking.expires_at = (
            timezone.now() + timedelta(minutes=settings.PAYMENT_WINDOW_MINUTES)
        )
        booking.save(update_fields=["payment_status", "expires_at", "updated_at"])

    return {
        "razorpay_key_id": settings.RAZORPAY_KEY_ID or "console_key",
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "booking_code": booking.booking_code,
    }

# ─── Synchronous verification (called by app after checkout) ─────────────

def verify_and_capture(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
) -> Booking:
    """
    Verify the signature returned by the Razorpay checkout SDK and mark the
    booking as paid.

    This runs synchronously in response to the app, but the *real* source of
    truth is the webhook. If verify succeeds but the webhook is delayed,
    the reconciliation cron will catch up.
    """
    logger.info("verify_and_capture razorpay_order_id=%s razorpay_payment_id=%s", razorpay_order_id, razorpay_payment_id)
    if not rzp.verify_payment_signature(
        razorpay_order_id, razorpay_payment_id, razorpay_signature,
    ):
        logger.warning(f"Invalid signature for order {razorpay_order_id}")
        raise ValidationError({
            "error": "Invalid payment signature",
            "code": ErrorCode.BAD_SIGNATURE,
        })

    try:
        payment = Payment.objects.select_related("booking").get(
            razorpay_order_id=razorpay_order_id,
        )
    except Payment.DoesNotExist:
        raise NotFound({
            "error": "Payment not found",
            "code": ErrorCode.PAYMENT_NOT_FOUND,
        })

    # Idempotency: if already captured, just return the booking
    if payment.status == Payment.Status.CAPTURED:
        return payment.booking

    with transaction.atomic():
        payment.razorpay_payment_id = razorpay_payment_id
        payment.status = Payment.Status.CAPTURED
        payment.captured_at = timezone.now()
        payment.save()

        booking = payment.booking
        _mark_booking_paid_and_maybe_accept(booking, by_user=None)

    logger.info(f"Booking {booking.booking_code} marked PAID via verify endpoint")
    _notify_payment_succeeded(booking, payment)
    return booking


# ─── Contact unlock (₹29 one-time, reveals host phone on a listing) ──────

def _host_phone(host) -> str | None:
    """Full dialable phone for a host user, or None."""
    num = getattr(host, "phone_number", "") or ""
    if not num:
        return None
    cc = getattr(host, "phone_country_code", "") or ""
    return f"{cc}{num}".strip()


def get_active_unlock(guest, listing) -> ContactUnlock | None:
    """Return the guest's captured unlock for this listing, if any."""
    return ContactUnlock.objects.filter(
        guest_user=guest, listing=listing, status=ContactUnlock.Status.UNLOCKED,
    ).first()


def create_order_for_unlock(guest, listing) -> dict:
    """
    Create a Razorpay order for unlocking a host's contact on a listing.

    Idempotent-ish: if the guest already unlocked this listing, we short-circuit
    with `already_unlocked` so the app can just reveal the number.
    """
    logger.info("create_order_for_unlock guest_id=%s listing_id=%s", getattr(guest, "id", None), getattr(listing, "id", None))

    if listing.host_user_id == guest.id:
        raise ValidationError({
            "error": "You cannot unlock your own listing",
            "code": ErrorCode.FORBIDDEN,
        })

    if get_active_unlock(guest, listing):
        return {"already_unlocked": True}

    fee = settings.CONTACT_UNLOCK_FEE
    notes = {
        "kind": "contact_unlock",
        "listing_id": str(listing.id),
        "guest_id": str(guest.id),
        "host_id": str(listing.host_user_id),
    }
    try:
        order = rzp.create_order(
            amount=fee,
            currency="INR",
            receipt=f"unlock_{str(listing.id)[:8]}_{str(guest.id)[:8]}",
            notes=notes,
        )
    except Exception as e:
        logger.error(f"Failed to create unlock order for listing {listing.id}: {e}")
        raise ValidationError({
            "error": "Could not create payment order",
            "code": ErrorCode.GATEWAY_ERROR,
        })

    ContactUnlock.objects.create(
        guest_user=guest,
        listing=listing,
        host_user=listing.host_user,
        razorpay_order_id=order["id"],
        amount=fee,
        currency="INR",
        status=ContactUnlock.Status.CREATED,
        raw_response=order,
    )

    return {
        "already_unlocked": False,
        "razorpay_key_id": settings.RAZORPAY_KEY_ID or "console_key",
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
    }


def verify_and_capture_unlock(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
) -> dict:
    """Verify the checkout signature and reveal the host's phone number."""
    logger.info("verify_and_capture_unlock order_id=%s", razorpay_order_id)
    if not rzp.verify_payment_signature(
        razorpay_order_id, razorpay_payment_id, razorpay_signature,
    ):
        logger.warning(f"Invalid signature for unlock order {razorpay_order_id}")
        raise ValidationError({
            "error": "Invalid payment signature",
            "code": ErrorCode.BAD_SIGNATURE,
        })

    try:
        unlock = ContactUnlock.objects.select_related("listing", "host_user").get(
            razorpay_order_id=razorpay_order_id,
        )
    except ContactUnlock.DoesNotExist:
        raise NotFound({
            "error": "Unlock not found",
            "code": ErrorCode.PAYMENT_NOT_FOUND,
        })

    newly_unlocked = unlock.status != ContactUnlock.Status.UNLOCKED
    if newly_unlocked:
        with transaction.atomic():
            unlock.razorpay_payment_id = razorpay_payment_id
            unlock.status = ContactUnlock.Status.UNLOCKED
            unlock.unlocked_at = timezone.now()
            unlock.save(update_fields=[
                "razorpay_payment_id", "status", "unlocked_at", "updated_at",
            ])
        _notify_contact_unlocked(unlock)

    return {
        "listing_id": str(unlock.listing_id),
        "host_name": _get_host_first_name(unlock.host_user),
        "host_phone": _host_phone(unlock.host_user),
    }


def _get_host_first_name(host) -> str:
    try:
        return host.profile.first_name or "your host"
    except Exception:
        return "your host"


def _notify_contact_unlocked(unlock: ContactUnlock) -> None:
    """Light in-app nudge to the host that a guest unlocked their contact."""
    try:
        guest_name = _get_host_first_name(unlock.guest_user)
    except Exception:
        guest_name = "A guest"
    try:
        dispatch(
            event_type=EventType.CONTACT_UNLOCKED,
            recipients=[unlock.host_user],
            context={
                "guest_name": guest_name,
                "listing_title": unlock.listing.title,
            },
            idempotency_event_id=f"contact_unlocked:{unlock.id}",
            channels=["in_app"],
        )
    except Exception:
        logger.exception("_notify_contact_unlocked failed")


# ─── Webhook handler (source of truth, async) ────────────────────────────

def handle_webhook(
    event_type: str, event_id: str, payload: dict, raw_body: bytes, signature: str,
) -> WebhookEvent:
    """
    Process an incoming Razorpay webhook event.

    Order of checks:
    1. Verify HMAC signature on raw_body
    2. Persist a WebhookEvent row (audit, even if signature invalid)
    3. Check Redis idempotency (so duplicate retries are dropped)
    4. Dispatch to the appropriate handler based on event_type
    """
    logger.info("handle_webhook event_type=%s event_id=%s", event_type, event_id)
    signature_valid = rzp.verify_webhook_signature(raw_body, signature)

    event = WebhookEvent.objects.create(
        event_id=event_id,
        event_type=event_type,
        payload=payload,
        signature_valid=signature_valid,
        status=WebhookEvent.Status.RECEIVED,
    )

    if not signature_valid:
        event.status = WebhookEvent.Status.IGNORED
        event.error_message = "Invalid signature"
        event.save(update_fields=["status", "error_message"])
        logger.warning(f"Webhook {event_id} rejected: bad signature")
        return event

    if idempotency_seen(event_id):
        event.status = WebhookEvent.Status.IGNORED
        event.error_message = "Duplicate event"
        event.processed_at = timezone.now()
        event.save(update_fields=["status", "error_message", "processed_at"])
        logger.info(f"Webhook {event_id} skipped: duplicate")
        return event

    try:
        _dispatch_webhook_event(event_type, payload)
        event.status = WebhookEvent.Status.PROCESSED
        event.processed_at = timezone.now()
        event.save(update_fields=["status", "processed_at"])
    except Exception as e:
        logger.exception(f"Failed processing webhook {event_id}")
        event.status = WebhookEvent.Status.FAILED
        event.error_message = str(e)
        event.save(update_fields=["status", "error_message"])

    return event


def _dispatch_webhook_event(event_type: str, payload: dict) -> None:
    """Route an event to its handler based on type."""
    logger.info("_dispatch_webhook_event event_type=%s", event_type)
    if event_type in (
        WebhookEventType.PAYMENT_CAPTURED,
        WebhookEventType.ORDER_PAID,  # sometimes fires alongside payment.captured
    ):
        _handle_payment_captured(payload)
    elif event_type == WebhookEventType.PAYMENT_FAILED:
        _handle_payment_failed(payload)
    elif event_type == WebhookEventType.REFUND_PROCESSED:
        _handle_refund_processed(payload)
    elif event_type == WebhookEventType.REFUND_FAILED:
        _handle_refund_failed(payload)
    else:
        logger.info(f"Webhook {event_type} ignored (not handled)")


def _handle_payment_captured(payload: dict) -> None:
    logger.info("_handle_payment_captured")
    pe = payload.get("payload", {}).get("payment", {}).get("entity", {})
    order_id = pe.get("order_id")
    payment_id = pe.get("id")
    method = pe.get("method")

    try:
        payment = Payment.objects.select_related("booking").get(razorpay_order_id=order_id)
    except Payment.DoesNotExist:
        logger.error(f"payment.captured for unknown order {order_id}")
        return

    if payment.status == Payment.Status.CAPTURED:
        return  # Already processed (sync verify or earlier webhook)

    with transaction.atomic():
        payment.razorpay_payment_id = payment_id
        payment.status = Payment.Status.CAPTURED
        payment.method = method if method in _VALID_PAYMENT_METHODS else Payment.Method.OTHER
        payment.captured_at = timezone.now()
        payment.raw_response = pe
        payment.save()

        _mark_booking_paid_and_maybe_accept(payment.booking, by_user=None)
        _notify_payment_succeeded(payment.booking, payment)

    logger.info(f"Webhook captured payment for booking {payment.booking.booking_code}")


def _handle_payment_failed(payload: dict) -> None:
    logger.info("_handle_payment_failed")
    pe = payload.get("payload", {}).get("payment", {}).get("entity", {})
    order_id = pe.get("order_id")

    try:
        payment = Payment.objects.select_related("booking").get(razorpay_order_id=order_id)
    except Payment.DoesNotExist:
        return

    payment.status = Payment.Status.FAILED
    payment.failed_at = timezone.now()
    payment.error_code = pe.get("error_code", "")
    payment.error_description = pe.get("error_description", "")
    payment.raw_response = pe
    payment.save()

    booking = payment.booking
    booking.payment_status = Booking.PaymentStatus.FAILED
    if booking.status == Booking.Status.PENDING:
        from_status = booking.status
        booking.status = Booking.Status.EXPIRED
        BookingStatusHistory.objects.create(
            booking=booking,
            from_status=from_status,
            to_status=Booking.Status.EXPIRED,
            changed_by_user=None,
            reason=f"{StatusChangeReason.PAYMENT_FAILED}: {payment.error_description or 'unknown'}",
        )
    booking.save()
    _notify_payment_failed(booking)
    logger.info(
        f"Payment failed for booking {booking.booking_code}: {payment.error_description}",
    )


def _handle_refund_processed(payload: dict) -> None:
    logger.info("_handle_refund_processed")
    re = payload.get("payload", {}).get("refund", {}).get("entity", {})
    refund_id = re.get("id")

    try:
        refund = Refund.objects.select_related("payment__booking").get(
            razorpay_refund_id=refund_id,
        )
    except Refund.DoesNotExist:
        logger.error(f"refund.processed for unknown refund {refund_id}")
        return

    refund.status = Refund.Status.PROCESSED
    refund.completed_at = timezone.now()
    refund.raw_response = re
    refund.save()

    booking = refund.payment.booking
    total_refunded = (
        Refund.objects.filter(
            payment__booking=booking, status=Refund.Status.PROCESSED,
        ).aggregate(t=Sum("amount"))["t"] or Decimal("0")
    )

    if total_refunded >= booking.total_guest_pays:
        booking.payment_status = Booking.PaymentStatus.REFUNDED
        refund.payment.status = Payment.Status.REFUNDED
    else:
        booking.payment_status = Booking.PaymentStatus.PARTIALLY_REFUNDED
        refund.payment.status = Payment.Status.PARTIALLY_REFUNDED
    refund.payment.save(update_fields=["status", "updated_at"])
    booking.save(update_fields=["payment_status", "updated_at"])

    _notify_refund_completed(booking, refund)

    logger.info(f"Refund {refund_id} processed; total refunded ₹{total_refunded}")


def _handle_refund_failed(payload: dict) -> None:
    logger.info("_handle_refund_failed")
    re = payload.get("payload", {}).get("refund", {}).get("entity", {})
    refund_id = re.get("id")
    try:
        refund = Refund.objects.get(razorpay_refund_id=refund_id)
    except Refund.DoesNotExist:
        return
    refund.status = Refund.Status.FAILED
    refund.raw_response = re
    refund.save()
    logger.error(f"Refund {refund_id} FAILED — needs ops attention")


# ─── Refund initiation ───────────────────────────────────────────────────

def initiate_refund_for_cancelled_booking(
    booking: Booking, amount: Decimal, cancelled_by: str,
) -> Refund | None:
    """Create a refund record and call Razorpay to actually refund the money."""
    logger.info("initiate_refund_for_cancelled_booking booking_id=%s amount=%s", getattr(booking, "id", None), amount)
    if amount <= 0:
        logger.info(f"No refund due for booking {booking.booking_code}")
        return None

    payment = booking.payments.filter(status=Payment.Status.CAPTURED).first()
    if not payment or not payment.razorpay_payment_id:
        logger.error(f"Cannot refund {booking.booking_code}: no captured payment")
        return None

    refund_row = Refund.objects.create(
        payment=payment,
        amount=amount,
        reason=_REFUND_REASON_BY_CANCELLER.get(cancelled_by, Refund.Reason.OPS_ADJUSTMENT),
        status=Refund.Status.INITIATED,
    )

    try:
        result = rzp.create_refund(
            payment.razorpay_payment_id,
            amount,
            notes={"booking_code": booking.booking_code, "reason": cancelled_by},
        )
        if result and result.get("id"):
            refund_row.razorpay_refund_id = result["id"]
            refund_row.raw_response = result
            # In console mode, our fake gateway returns 'processed' immediately
            if result.get("status") == Refund.Status.PROCESSED:
                refund_row.status = Refund.Status.PROCESSED
                refund_row.completed_at = timezone.now()
            refund_row.save()
            logger.info(f"Refund initiated for {booking.booking_code}: {result['id']}")
        else:
            refund_row.status = Refund.Status.FAILED
            refund_row.save()
            logger.error(f"Refund call returned no id for {booking.booking_code}")
    except Exception as e:
        refund_row.status = Refund.Status.FAILED
        refund_row.save()
        logger.exception(f"Refund failed for {booking.booking_code}: {e}")

    return refund_row


# ─── Internal helpers ────────────────────────────────────────────────────

def _mark_booking_paid_and_maybe_accept(booking: Booking, by_user) -> None:
    """
    Mark a booking as paid. If it's an instant-mode booking still in PENDING,
    auto-transition to ACCEPTED and log the status change.

    Caller must wrap this in a transaction.
    """
    logger.info("_mark_booking_paid_and_maybe_accept booking_id=%s", getattr(booking, "id", None))
    booking.payment_status = Booking.PaymentStatus.PAID
    booking.expires_at = None

    if (
        booking.status == Booking.Status.PENDING
        and booking.booking_mode == Booking.BookingMode.INSTANT
    ):
        from_status = booking.status
        booking.status = Booking.Status.ACCEPTED
        booking.host_responded_at = timezone.now()
        BookingStatusHistory.objects.create(
            booking=booking,
            from_status=from_status,
            to_status=Booking.Status.ACCEPTED,
            changed_by_user=by_user,
            reason=StatusChangeReason.AUTO_ACCEPT_INSTANT,
        )

    booking.save()

def _user_first_name(user) -> str:
    """Safely get a user's first name from their profile; falls back to 'there'."""
    if not user:
        return "there"
    profile = getattr(user, "profile", None)
    if profile and profile.first_name:
        return profile.first_name
    return "there"

def _get_cover_photo(listing):
    """
    Return the absolute URL of the listing's cover photo, or None.

    Logic:
      1. PropertyPhoto with is_cover=True for this listing's property.
      2. Fallback: lowest sort_order approved photo.
      3. None if no usable photo (template handles None gracefully).
    """
    prop = getattr(listing, "property", None)
    if prop is None:
        return None

    # Lazy import to avoid circular imports

    cover = (
        PropertyPhoto.objects
        .filter(
            property=prop,
            is_cover=True,
            moderation_status=PropertyPhoto.ModerationStatus.APPROVED,
        )
        .first()
    )
    if cover:
        return cover.url

    fallback = (
        PropertyPhoto.objects
        .filter(
            property=prop,
            moderation_status=PropertyPhoto.ModerationStatus.APPROVED,
        )
        .order_by("sort_order", "uploaded_at")
        .first()
    )
    return fallback.url if fallback else None


def _get_location_string(listing) -> str:
    """
    Build a human-readable address string from the listing's property.
    Format: "<apartment_name>, Floor <n>, <address_line1>, <address_line2>,
             <city_name> - <pincode>"
    Falls back to formatted_address, then city_name.
    """
    prop = getattr(listing, "property", None)
    if prop is None:
        return ""

    parts = []
    if getattr(prop, "apartment_name", None):
        parts.append(prop.apartment_name.strip())
    if getattr(prop, "floor_number", None) is not None:
        floor = prop.floor_number
        if floor == 0:
            parts.append("Ground floor")
        else:
            parts.append(f"Floor {floor}")
    if prop.address_line1:
        parts.append(prop.address_line1.strip())
    if prop.address_line2:
        parts.append(prop.address_line2.strip())

    tail_bits = []
    if prop.city_name:
        tail_bits.append(prop.city_name.strip())
    if prop.pincode:
        pin = str(prop.pincode).strip()
        if tail_bits:
            tail_bits[-1] = f"{tail_bits[-1]} - {pin}"
        else:
            tail_bits.append(pin)
    parts.extend(tail_bits)

    if parts:
        return ", ".join(parts)
    if prop.formatted_address:
        return prop.formatted_address.strip()
    return prop.city_name or ""

def _build_booking_context(booking) -> dict:
    listing = booking.listing
    nights = booking.nights or 1

    # Free-cancellation deadline derived from the booking's cancellation policy.
    # FLEXIBLE = 100% refund if cancelled 2+ days before check-in; 50% thereafter.
    # MODERATE = 100% if 7+ days before; 50% if 2–6 days; 0% within 2 days.
    # STRICT   = 50% if 7+ days before; 0% thereafter.
    free_cancel_text = ""
    cancellation_policy_label = ""
    cancellation_policy_detail = ""
    try:
        policy = booking.cancellation_policy
        if policy == booking.CancellationPolicy.MODERATE:
            deadline = booking.check_in_date - timedelta(days=7)
            free_cancel_text = deadline.strftime("%d %b %Y")
            cancellation_policy_label = "Moderate"
            cancellation_policy_detail = (
                f"100% refund if cancelled before {free_cancel_text}. "
                f"50% refund 2–6 days before check-in. No refund within 2 days."
            )
        elif policy == booking.CancellationPolicy.STRICT:
            deadline = booking.check_in_date - timedelta(days=7)
            free_cancel_text = deadline.strftime("%d %b %Y")
            cancellation_policy_label = "Strict"
            cancellation_policy_detail = (
                f"50% refund if cancelled before {free_cancel_text}. "
                f"No refund thereafter."
            )
        else:  # FLEXIBLE or None
            deadline = booking.check_in_date - timedelta(days=2)
            free_cancel_text = deadline.strftime("%d %b %Y")
            cancellation_policy_label = "Flexible"
            cancellation_policy_detail = (
                f"100% refund if cancelled before {free_cancel_text}. "
                f"50% refund after that."
            )
    except Exception:
        logger.exception("_build_booking_context failed")
        pass

    return {
        # Display fields
        "property_name": listing.title,
        "booking_id": str(booking.id),
        "booking_reference": booking.booking_code,
        "check_in": booking.check_in_date.strftime("%a, %d %b %Y"),
        "check_out": booking.check_out_date.strftime("%a, %d %b %Y"),
        "nights": nights,
        "guest_count": booking.number_of_guests,
        "amount": f"{booking.total_guest_pays:,.0f}",
        "platform_fee": f"{booking.platform_fee:,.0f}",
        "subtotal": f"{booking.subtotal:,.0f}",
        "security_deposit": f"{booking.security_deposit:,.0f}",
        "meal_total": f"{(booking.meal_total or 0):,.0f}",
        "pay_to_host_directly": f"{(booking.subtotal + booking.security_deposit + (booking.meal_total or 0)):,.0f}",
        "tax_amount": f"{booking.gst_amount:,.0f}",
        "per_night_amount": f"{booking.guest_nightly_price:,.0f}",

        # Property
        "cover_photo_url": _get_cover_photo(listing),
        "location": _get_location_string(listing),

        # Contact
        "host_name": _user_first_name(booking.host_user),
        "host_phone": f"{booking.host_user.phone_country_code}{booking.host_user.phone_number}",

        # Cancellation
        "free_cancellation_deadline": free_cancel_text,
        "cancellation_policy_label": cancellation_policy_label,
        "cancellation_policy_detail": cancellation_policy_detail,

        # Links
        "booking_url": f"{settings.APP_BASE_URL}/bookings/{booking.id}",

        # MSG91 stays the same
        "msg91_flow_id": "",
        "msg91_variables": {},
    }

def _notify_payment_succeeded(booking, payment) -> None:
    base = _build_booking_context(booking)
    guest = booking.guest_user
    host = booking.host_user

    # ── Notify host: "New booking request" (one email only) ──────────────
    if host:
        guest_profile = getattr(guest, "profile", None)
        guest_display = ""
        if guest_profile:
            first = getattr(guest_profile, "first_name", "") or ""
            last = getattr(guest_profile, "last_name", "") or ""
            guest_display = f"{first} {last}".strip()
        guest_display = guest_display or getattr(guest, "mobile_number", "") or "A guest"
        guest_phone = getattr(guest, "mobile_number", "") or ""

        try:
            dispatch(
                event_type=EventType.BOOKING_NEW,
                recipients=[host],
                context={
                    **base,
                    "recipient_name": _user_first_name(host),
                    "guest_name": guest_display,
                    "guest_phone": guest_phone,
                },
                idempotency_event_id=f"booking_new:{booking.id}",
            )
        except Exception:
            logger.exception("Failed to notify host of new booking %s", booking.booking_code)

    # ── Notify guest: "Payment received, awaiting host confirmation" ─────
    if guest:
        dispatch(
            event_type=EventType.BOOKING_PAYMENT_SUCCEEDED,
            recipients=[guest],
            context={**base, "recipient_name": _user_first_name(guest), "recipient_role": "guest"},
            idempotency_event_id=f"payment_succeeded:{payment.id}",
        )

    # ── Instant booking: auto-accepted, send confirmation + invoice ──────
    if booking.status == booking.Status.ACCEPTED and guest:
        dispatch(
            event_type=EventType.BOOKING_HOST_ACCEPTED,
            recipients=[guest],
            context={**base, "recipient_name": _user_first_name(guest)},
            idempotency_event_id=f"host_accepted:{booking.id}",
        )
        _send_invoice_email(booking, guest, base)


def _notify_payment_failed(booking) -> None:
    base = _build_booking_context(booking)
    guest = booking.guest_user
    if guest:
        dispatch(
            event_type=EventType.BOOKING_PAYMENT_FAILED,
            recipients=[guest],
            context={**base, "recipient_name": _user_first_name(guest)},
            idempotency_event_id=f"payment_failed:{booking.id}",
        )


def _notify_refund_completed(booking, refund) -> None:
    base = _build_booking_context(booking)
    base["amount"] = f"{refund.amount:.2f}"
    guest = booking.guest_user
    if guest:
        dispatch(
            event_type=EventType.BOOKING_REFUND_COMPLETED,
            recipients=[guest],
            context={**base, "recipient_name": _user_first_name(guest)},
            idempotency_event_id=f"refund_completed:{refund.id}",
        )

def _send_invoice_email(booking, guest, context: dict) -> None:
    """Generate PDF invoice and email it to the guest with HTML template + PDF attachment."""

    guest_email = getattr(guest, "email", None)
    if not guest_email:
        logger.warning(
            "_send_invoice_email: guest %s has no email, skipping", guest.id
        )
        return

    # Generate PDF
    try:
        pdf_bytes = generate_booking_invoice(booking)
    except Exception:
        logger.exception(
            "_send_invoice_email: PDF generation failed for booking %s",
            booking.booking_code,
        )
        return

    if not pdf_bytes:
        logger.warning(
            "_send_invoice_email: empty PDF for booking %s", booking.booking_code
        )
        return

    # Build template context — reuse existing context + invoice-specific fields
    policy = booking.cancellation_policy or "flexible"
    policy_text = {
        "flexible": "100% refund if cancelled 2+ days before check-in; 50% refund thereafter.",
        "moderate": "100% refund if cancelled 7+ days before; 50% refund 2–6 days before; no refund within 2 days.",
        "strict":   "50% refund if cancelled 7+ days before check-in; no refund thereafter.",
    }.get(policy, "")

    template_context = {
        **context,
        "recipient_name": booking.guest_name.split()[0] if booking.guest_name else _user_first_name(guest),
        "platform_fee": f"{booking.platform_fee:,.0f}",
        "security_deposit": f"{float(booking.security_deposit or 0):,.0f}",
        "meal_total": f"{float(booking.meal_total or 0):,.0f}" if booking.meal_option_selected else "0",
        "meal_cost_per_day": f"{float(booking.meal_cost_per_day or 0):,.0f}",
        "cancellation_policy_text": policy_text,
        "current_year": "2026",
    }

    # Render HTML body from template
    body = render_to_string("emails/booking_invoice_email.html", template_context)
    subject = f"Your booking invoice — {booking.booking_code}"
    filename = f"RoomBuddy_Invoice_{booking.booking_code}.pdf"

    try:
        provider = SESEmailProvider()
        result = provider.send_with_attachment(
            recipient=guest_email,
            subject=subject,
            body=body,
            attachment_bytes=pdf_bytes,
            attachment_filename=filename,
        )
        if result.success:
            logger.info(
                "_send_invoice_email: invoice sent to %s for booking %s",
                guest_email, booking.booking_code,
            )
        else:
            logger.error(
                "_send_invoice_email: SES failed for %s — %s",
                booking.booking_code, result.error,
            )
    except Exception:
        logger.exception(
            "_send_invoice_email: unexpected error for booking %s",
            booking.booking_code,
        )
