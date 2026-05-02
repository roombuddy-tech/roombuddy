"""
Payment service.

Three core operations:
- create_order_for_booking()         : creates a Razorpay order for a confirmed booking
- verify_and_capture()               : verifies signature after checkout, marks booking as paid
- handle_webhook()                   : processes async events from Razorpay
- initiate_refund_for_cancelled_booking() : kicks off a refund

This is Phase 1 — no Razorpay Route. Money lands in RoomBuddy's gateway account
and is paid to hosts manually (weekly via UPI). When you switch to Phase 2,
extend create_order to include `transfers=[...]`.
"""
import logging
import os
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError, NotFound

from apps.bookings.models import Booking, BookingStatusHistory
from apps.payments.models import Payment, Refund, WebhookEvent
from common.redis_utils import idempotency_seen
from third_party import razorpay as rzp

logger = logging.getLogger(__name__)


# ─── Order creation (called when guest is ready to pay) ──────────────────

def create_order_for_booking(booking: Booking) -> dict:
    """
    Creates a Razorpay order for the booking with a 15-minute payment window.
    """
    from datetime import timedelta

    if booking.status not in (Booking.Status.PENDING, Booking.Status.ACCEPTED):
        raise ValidationError({"error": "Booking is not in a payable state", "code": "INVALID_STATE"})

    if booking.payment_status == Booking.PaymentStatus.PAID:
        raise ValidationError({"error": "Booking is already paid", "code": "ALREADY_PAID"})

    existing = booking.payments.exclude(status=Payment.Status.FAILED).first()
    if existing and existing.status == Payment.Status.CAPTURED:
        raise ValidationError({"error": "Booking is already paid", "code": "ALREADY_PAID"})

    PAYMENT_WINDOW_MINUTES = 15
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
            expire_in_minutes=PAYMENT_WINDOW_MINUTES,
        )
    except Exception as e:
        logger.error(f"Failed to create Razorpay order for {booking.booking_code}: {e}")
        raise ValidationError({"error": "Could not create payment order", "code": "GATEWAY_ERROR"})

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
        # Set the expiry on the booking — matches Razorpay's order expiry
        booking.expires_at = timezone.now() + timedelta(minutes=PAYMENT_WINDOW_MINUTES)
        booking.save(update_fields=["payment_status", "expires_at", "updated_at"])

    import os
    return {
        "razorpay_key_id": os.getenv("RAZORPAY_KEY_ID", "console_key"),
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

    Note: this runs synchronously in response to the app, but the *real* source
    of truth is the webhook (`handle_webhook`). If this verify call succeeds
    but the webhook is delayed, the reconciliation cron will catch up later.
    """
    if not rzp.verify_payment_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature):
        logger.warning(f"Invalid signature for order {razorpay_order_id}")
        raise ValidationError({"error": "Invalid payment signature", "code": "BAD_SIGNATURE"})

    try:
        payment = Payment.objects.select_related("booking").get(
            razorpay_order_id=razorpay_order_id,
        )
    except Payment.DoesNotExist:
        raise NotFound({"error": "Payment not found", "code": "PAYMENT_NOT_FOUND"})

    # Idempotency: if already captured, just return the booking
    if payment.status == Payment.Status.CAPTURED:
        return payment.booking

    with transaction.atomic():
        payment.razorpay_payment_id = razorpay_payment_id
        payment.status = Payment.Status.CAPTURED
        payment.captured_at = timezone.now()
        payment.save()

        booking = payment.booking
        booking.payment_status = Booking.PaymentStatus.PAID
        # If listing was instant-booking, transition to ACCEPTED on payment
        if booking.status == Booking.Status.PENDING and booking.booking_mode == Booking.BookingMode.INSTANT:
            from_status = booking.status
            booking.status = Booking.Status.ACCEPTED
            booking.host_responded_at = timezone.now()
            BookingStatusHistory.objects.create(
                booking=booking, from_status=from_status, to_status=Booking.Status.ACCEPTED,
                changed_by_user=None, reason="Auto-accepted on instant booking payment",
            )
        booking.save()

    logger.info(f"Booking {booking.booking_code} marked PAID via verify endpoint")
    return booking


# ─── Webhook handler (source of truth, async) ────────────────────────────

def handle_webhook(event_type: str, event_id: str, payload: dict, raw_body: bytes, signature: str) -> WebhookEvent:
    """
    Process an incoming Razorpay webhook event.

    Order of checks:
    1. Verify HMAC signature on raw_body
    2. Check Redis idempotency (so duplicates from retries are dropped)
    3. Persist a WebhookEvent row regardless (audit)
    4. Dispatch to the appropriate handler based on event_type
    """
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

    # Idempotency check via Redis (stops duplicate deliveries)
    if idempotency_seen(event_id):
        event.status = WebhookEvent.Status.IGNORED
        event.error_message = "Duplicate event"
        event.processed_at = timezone.now()
        event.save(update_fields=["status", "error_message", "processed_at"])
        logger.info(f"Webhook {event_id} skipped: duplicate")
        return event

    try:
        if event_type == "payment.captured":
            _handle_payment_captured(payload)
        elif event_type == "payment.failed":
            _handle_payment_failed(payload)
        elif event_type == "refund.processed":
            _handle_refund_processed(payload)
        elif event_type == "refund.failed":
            _handle_refund_failed(payload)
        elif event_type == "order.paid":
            _handle_payment_captured(payload)
        else:
            logger.info(f"Webhook {event_type} ignored (not handled)")

        event.status = WebhookEvent.Status.PROCESSED
        event.processed_at = timezone.now()
        event.save(update_fields=["status", "processed_at"])
    except Exception as e:
        logger.exception(f"Failed processing webhook {event_id}")
        event.status = WebhookEvent.Status.FAILED
        event.error_message = str(e)
        event.save(update_fields=["status", "error_message"])

    return event


def _handle_payment_captured(payload: dict) -> None:
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
        return  # Already processed

    with transaction.atomic():
        payment.razorpay_payment_id = payment_id
        payment.status = Payment.Status.CAPTURED
        payment.method = method if method in dict(Payment.Method.choices) else Payment.Method.OTHER
        payment.captured_at = timezone.now()
        payment.raw_response = pe
        payment.save()

        booking = payment.booking
        booking.payment_status = Booking.PaymentStatus.PAID
        if booking.status == Booking.Status.PENDING and booking.booking_mode == Booking.BookingMode.INSTANT:
            booking.status = Booking.Status.ACCEPTED
            booking.host_responded_at = timezone.now()
        booking.save()

    logger.info(f"Webhook captured payment for booking {payment.booking.booking_code}")


def _handle_payment_failed(payload: dict) -> None:
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
            booking=booking, from_status=from_status, to_status=Booking.Status.EXPIRED,
            changed_by_user=None, reason=f"Payment failed: {payment.error_description or 'unknown'}",
        )
    booking.save()
    logger.info(f"Payment failed for booking {booking.booking_code}: {payment.error_description}")


def _handle_refund_processed(payload: dict) -> None:
    re = payload.get("payload", {}).get("refund", {}).get("entity", {})
    refund_id = re.get("id")

    try:
        refund = Refund.objects.select_related("payment__booking").get(razorpay_refund_id=refund_id)
    except Refund.DoesNotExist:
        logger.error(f"refund.processed for unknown refund {refund_id}")
        return

    refund.status = Refund.Status.PROCESSED
    refund.completed_at = timezone.now()
    refund.raw_response = re
    refund.save()

    # Update the booking's payment_status
    booking = refund.payment.booking
    total_refunded = booking.payments.filter(status__in=[
        Payment.Status.CAPTURED, Payment.Status.REFUNDED, Payment.Status.PARTIALLY_REFUNDED,
    ]).aggregate_refunded() if False else None
    # Simpler: sum processed refunds for this booking's payment
    from django.db.models import Sum
    total_refunded = Refund.objects.filter(
        payment__booking=booking, status=Refund.Status.PROCESSED,
    ).aggregate(t=Sum("amount"))["t"] or Decimal("0")

    if total_refunded >= booking.total_guest_pays:
        booking.payment_status = Booking.PaymentStatus.REFUNDED
        refund.payment.status = Payment.Status.REFUNDED
    else:
        booking.payment_status = Booking.PaymentStatus.PARTIALLY_REFUNDED
        refund.payment.status = Payment.Status.PARTIALLY_REFUNDED
    refund.payment.save(update_fields=["status", "updated_at"])
    booking.save(update_fields=["payment_status", "updated_at"])

    logger.info(f"Refund {refund_id} processed; total refunded ₹{total_refunded}")


def _handle_refund_failed(payload: dict) -> None:
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
    booking: Booking, amount: Decimal, who_cancelled: str,
) -> Refund | None:
    """Create a refund record and call Razorpay to actually refund the money."""
    if amount <= 0:
        logger.info(f"No refund due for booking {booking.booking_code}")
        return None

    payment = booking.payments.filter(status=Payment.Status.CAPTURED).first()
    if not payment or not payment.razorpay_payment_id:
        logger.error(f"Cannot refund {booking.booking_code}: no captured payment")
        return None

    reason_map = {
        "guest": Refund.Reason.GUEST_CANCEL,
        "host": Refund.Reason.HOST_CANCEL,
        "system": Refund.Reason.AUTO_EXPIRE,
    }

    refund_row = Refund.objects.create(
        payment=payment,
        amount=amount,
        reason=reason_map.get(who_cancelled, Refund.Reason.OPS_ADJUSTMENT),
        status=Refund.Status.INITIATED,
    )

    try:
        result = rzp.create_refund(
            payment.razorpay_payment_id,
            amount,
            notes={"booking_code": booking.booking_code, "reason": who_cancelled},
        )
        if result and result.get("id"):
            refund_row.razorpay_refund_id = result["id"]
            refund_row.raw_response = result
            # In console mode, our fake gateway returns 'processed' immediately
            if result.get("status") == "processed":
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