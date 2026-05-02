from datetime import date, timedelta
from decimal import Decimal
import logging
import secrets
import string

from django.db import transaction
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied
from apps.payments.services import initiate_refund_for_cancelled_booking

from apps.bookings.models import Booking, BookingStatusHistory
from apps.listings.models import Listing
from apps.users.models import User
from common.redis_utils import distributed_lock
from common.utils import get_display_name, get_initials

logger = logging.getLogger(__name__)


class BookingConflictError(Exception):
    """Raised when the requested dates overlap with another booking."""


def _generate_booking_code() -> str:
    """RB-ABC123XY style code, unique."""
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = "RB-" + "".join(secrets.choice(alphabet) for _ in range(8))
        if not Booking.objects.filter(booking_code=code).exists():
            return code


def _has_overlap(listing_id, check_in: date, check_out: date) -> bool:
    """
    A booking blocks others if:
    - It's accepted/active (paid, real booking) → always blocks
    - It's pending AND not yet expired → blocks (someone might still pay)
    - It's pending AND expired → DOESN'T block (treated as abandoned)

    A booking overlaps if existing.check_in < new.check_out AND existing.check_out > new.check_in.
    """

    now = timezone.now()
    return Booking.objects.filter(
        listing_id=listing_id,
        check_in_date__lt=check_out,
        check_out_date__gt=check_in,
    ).filter(
        Q(status__in=[Booking.Status.ACCEPTED, Booking.Status.ACTIVE]) |
        Q(status=Booking.Status.PENDING, expires_at__gt=now) |
        # Edge case: pending bookings created before this feature (no expires_at) — block them
        Q(status=Booking.Status.PENDING, expires_at__isnull=True)
    ).exists()


def quote_booking(listing_id, check_in: date, check_out: date) -> dict:
    """
    Return a price breakdown for the given listing/dates without creating anything.
    Used by the app to show the guest what they'll pay before confirming.
    """
    if check_out <= check_in:
        raise ValidationError({"error": "check_out_date must be after check_in_date", "code": "INVALID_DATES"})

    try:
        listing = Listing.objects.get(id=listing_id, status=Listing.Status.LIVE)
    except Listing.DoesNotExist:
        raise NotFound({"error": "Listing not found or not available", "code": "LISTING_NOT_FOUND"})

    nights = (check_out - check_in).days
    if nights < listing.min_nights:
        raise ValidationError({"error": f"Minimum stay is {listing.min_nights} nights", "code": "MIN_NIGHTS"})
    if nights > listing.max_nights:
        raise ValidationError({"error": f"Maximum stay is {listing.max_nights} nights", "code": "MAX_NIGHTS"})

    host_nightly = listing.host_price_per_night
    gst_per_night = (host_nightly * listing.gst_pct / Decimal(100)).quantize(Decimal("0.01"))
    fee_per_night = (host_nightly * listing.platform_fee_pct / Decimal(100)).quantize(Decimal("0.01"))
    guest_nightly = host_nightly + gst_per_night + fee_per_night

    subtotal = (host_nightly * nights).quantize(Decimal("0.01"))
    gst_amount = (gst_per_night * nights).quantize(Decimal("0.01"))
    platform_fee = (fee_per_night * nights).quantize(Decimal("0.01"))
    security_deposit = listing.security_deposit
    total_guest_pays = (subtotal + gst_amount + platform_fee + security_deposit).quantize(Decimal("0.01"))
    total_host_receives = subtotal
    platform_revenue = (platform_fee + gst_amount).quantize(Decimal("0.01"))

    return {
        "listing_id": str(listing.id),
        "nights": nights,
        "host_nightly_price": float(host_nightly),
        "guest_nightly_price": float(guest_nightly),
        "subtotal": float(subtotal),
        "gst_amount": float(gst_amount),
        "platform_fee": float(platform_fee),
        "security_deposit": float(security_deposit),
        "total_guest_pays": float(total_guest_pays),
        "total_host_receives": float(total_host_receives),
        "platform_revenue": float(platform_revenue),
        "currency": listing.currency,
        "booking_mode": listing.booking_mode,
    }


def create_booking(
    user: User,
    listing_id,
    check_in: date,
    check_out: date,
    number_of_guests: int = 1,
    guest_purpose: str | None = None,
    special_requests: str | None = None,
) -> Booking:
    """
    Create a booking row in `pending` state.

    Wrapped in a Redis distributed lock to prevent two guests from booking the
    same dates at the same time. Also enforces a DB-level overlap check.
    """
    if check_out <= check_in:
        raise ValidationError({"error": "check_out_date must be after check_in_date", "code": "INVALID_DATES"})

    if check_in < date.today():
        raise ValidationError({"error": "check_in_date cannot be in the past", "code": "PAST_DATE"})

    quote = quote_booking(listing_id, check_in, check_out)
    listing = Listing.objects.select_related("house_rules").get(id=listing_id)

    if listing.host_user_id == user.id:
        raise PermissionDenied({"error": "You cannot book your own listing", "code": "SELF_BOOKING"})

    lock_key = f"book:{listing_id}:{check_in.isoformat()}:{check_out.isoformat()}"

    with distributed_lock(lock_key, ttl_seconds=120) as acquired:
        if not acquired:
            raise BookingConflictError("Another guest is currently booking these dates")

        # Double-check at DB level inside the lock
        if _has_overlap(listing_id, check_in, check_out):
            raise BookingConflictError("These dates are no longer available")

        cancellation_policy = (
            listing.house_rules.cancellation_policy
            if hasattr(listing, "house_rules") and listing.house_rules
            else Booking.CancellationPolicy.MODERATE
        )

        with transaction.atomic():
            booking = Booking.objects.create(
                booking_code=_generate_booking_code(),
                listing=listing,
                guest_user=user,
                host_user=listing.host_user,
                check_in_date=check_in,
                check_out_date=check_out,
                number_of_guests=number_of_guests,
                guest_purpose=guest_purpose,
                special_requests=special_requests,
                booking_mode=listing.booking_mode,
                status=Booking.Status.PENDING,
                payment_status=Booking.PaymentStatus.UNPAID,
                host_nightly_price=Decimal(str(quote["host_nightly_price"])),
                guest_nightly_price=Decimal(str(quote["guest_nightly_price"])),
                subtotal=Decimal(str(quote["subtotal"])),
                gst_amount=Decimal(str(quote["gst_amount"])),
                platform_fee=Decimal(str(quote["platform_fee"])),
                security_deposit=Decimal(str(quote["security_deposit"])),
                total_guest_pays=Decimal(str(quote["total_guest_pays"])),
                total_host_receives=Decimal(str(quote["total_host_receives"])),
                platform_revenue=Decimal(str(quote["platform_revenue"])),
                currency=quote["currency"],
                cancellation_policy=cancellation_policy,
                # If REQUEST mode, host has 24h to respond
                host_response_deadline=(
                    timezone.now() + timedelta(hours=24)
                    if listing.booking_mode == Listing.BookingMode.REQUEST
                    else None
                ),
            )

            BookingStatusHistory.objects.create(
                booking=booking,
                from_status=None,
                to_status=Booking.Status.PENDING,
                changed_by_user=user,
                reason="Booking created",
            )

        logger.info(f"Booking {booking.booking_code} created for guest {user.id}")
        return booking


# ─── Cancellation & refund ───────────────────────────────────────────────

def compute_refund_amount(booking: Booking, who_cancelled: str) -> Decimal:
    """
    Compute refund amount based on cancellation policy and time-to-check-in.

    who_cancelled = 'guest' | 'host' | 'system'

    - If host cancels: full refund (including platform fee).
    - If system cancels (host didn't respond, etc.): full refund.
    - If guest cancels: depends on policy and how close to check-in.
    """
    if who_cancelled in ("host", "system"):
        return booking.total_guest_pays

    # Guest cancellation: depends on policy
    days_to_checkin = (booking.check_in_date - date.today()).days

    base_refundable = booking.subtotal + booking.gst_amount + booking.security_deposit
    # Platform fee is non-refundable on guest cancellation

    policy = booking.cancellation_policy or Booking.CancellationPolicy.MODERATE

    if policy == Booking.CancellationPolicy.FLEXIBLE:
        if days_to_checkin >= 2:
            return base_refundable                # 100%
        return (base_refundable * Decimal("0.50")).quantize(Decimal("0.01"))   # 50%
    elif policy == Booking.CancellationPolicy.MODERATE:
        if days_to_checkin >= 7:
            return base_refundable                # 100%
        elif days_to_checkin >= 2:
            return (base_refundable * Decimal("0.50")).quantize(Decimal("0.01"))
        return Decimal("0")                       # 0%
    else:  # STRICT
        if days_to_checkin >= 7:
            return (base_refundable * Decimal("0.50")).quantize(Decimal("0.01"))
        return Decimal("0")


def cancel_booking(booking: Booking, user: User, reason: str = "") -> Booking:
    """Cancel a booking and trigger refund if applicable."""
    if booking.status in (
        Booking.Status.CANCELLED_BY_GUEST,
        Booking.Status.CANCELLED_BY_HOST,
        Booking.Status.COMPLETED,
        Booking.Status.NO_SHOW,
    ):
        raise ValidationError({"error": "Booking cannot be cancelled", "code": "INVALID_STATE"})

    if user.id == booking.guest_user_id:
        who = "guest"
        new_status = Booking.Status.CANCELLED_BY_GUEST
    elif user.id == booking.host_user_id:
        who = "host"
        new_status = Booking.Status.CANCELLED_BY_HOST
    else:
        raise PermissionDenied({"error": "Not allowed to cancel this booking", "code": "FORBIDDEN"})

    refund_amount = compute_refund_amount(booking, who)

    with transaction.atomic():
        from_status = booking.status
        booking.status = new_status
        booking.cancelled_at = timezone.now()
        booking.cancellation_reason = reason
        booking.refund_amount = refund_amount
        if booking.payment_status == Booking.PaymentStatus.PAID and refund_amount > 0:
            booking.payment_status = Booking.PaymentStatus.REFUND_PENDING
        booking.save()

        BookingStatusHistory.objects.create(
            booking=booking,
            from_status=from_status,
            to_status=new_status,
            changed_by_user=user,
            reason=reason or f"Cancelled by {who}",
        )

    # If a payment exists, kick off the actual refund via the payment service.
    if booking.payment_status == Booking.PaymentStatus.REFUND_PENDING:
        initiate_refund_for_cancelled_booking(booking, refund_amount, who)

    logger.info(f"Booking {booking.booking_code} cancelled by {who}; refund=₹{refund_amount}")
    return booking


def get_host_bookings(user: User, status_filter: str = "all") -> list[dict]:
    """Returns list of bookings for a host, optionally filtered by status."""
    queryset = Booking.objects.filter(
        host_user=user
    ).select_related("guest_user").order_by("-created_at")

    if status_filter == "active":
        queryset = queryset.filter(status__in=[Booking.Status.ACTIVE, Booking.Status.ACCEPTED])
    elif status_filter == "upcoming":
        queryset = queryset.filter(status__in=[Booking.Status.PENDING, Booking.Status.ACCEPTED])
    elif status_filter == "completed":
        queryset = queryset.filter(status=Booking.Status.COMPLETED)

    return [_booking_to_dict(b) for b in queryset]


def get_host_earnings(user: User) -> dict:
    """Returns lifetime earnings, monthly breakdown, and payout info."""
    completed = Booking.objects.filter(
        host_user=user,
        status__in=[Booking.Status.COMPLETED, Booking.Status.ACTIVE],
    )

    # Lifetime
    lifetime_agg = completed.aggregate(
        total_earnings=Sum("total_host_receives"),
        total_bookings=Count("id"),
    )
    total_nights = sum(b.nights for b in completed)

    # Monthly
    monthly = [
        {
            "month": row["month"].strftime("%b %Y"),
            "month_iso": row["month"].strftime("%Y-%m"),
            "earnings": float(row["earnings"] or 0),
            "bookings": row["bookings"],
        }
        for row in completed.annotate(month=TruncMonth("check_in_date"))
        .values("month")
        .annotate(earnings=Sum("total_host_receives"), bookings=Count("id"))
        .order_by("-month")
    ]

    return {
        "lifetime": {
            "total_earnings": float(lifetime_agg["total_earnings"] or 0),
            "total_bookings": lifetime_agg["total_bookings"] or 0,
            "total_nights": total_nights,
        },
        "monthly": monthly,
        "payout": {
            "bank_name": None,
            "account_last4": None,
            "payout_schedule": None,
            "next_payout_amount": None,
            "next_payout_date": None,
        },
    }


def _booking_to_dict(b: Booking) -> dict:
    """Convert a Booking model instance to a response dict."""
    return {
        "booking_id": str(b.id),
        "booking_code": b.booking_code,
        "guest_name": get_display_name(b.guest_user),
        "guest_initials": get_initials(b.guest_user),
        "check_in_date": b.check_in_date.isoformat(),
        "check_out_date": b.check_out_date.isoformat(),
        "nights": b.nights,
        "guest_purpose": b.guest_purpose,
        "status": b.status,
        "total_guest_pays": float(b.total_guest_pays),
        "total_host_receives": float(b.total_host_receives),
    }