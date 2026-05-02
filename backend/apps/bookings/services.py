import logging
import secrets
import string
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.bookings.models import Booking, BookingStatusHistory
from apps.listings.models import Listing
from apps.payments.services import initiate_refund_for_cancelled_booking
from apps.users.models import User, PayoutAccount
from common.constants import (
    BOOKING_CODE_LENGTH,
    BOOKING_CODE_PREFIX,
    DEFAULT_CANCELLATION_POLICY,
    MONEY_PRECISION,
    PERCENT_DENOMINATOR,
    REFUND_SCHEDULES,
    StatusChangeReason,
)
from common.error_codes import ErrorCode
from common.redis_utils import distributed_lock
from common.utils import get_display_name, get_initials

logger = logging.getLogger(__name__)


class BookingConflictError(Exception):
    """Raised when the requested dates overlap with another booking."""


def _generate_booking_code() -> str:
    """RB-ABC123XY style code, unique."""
    alphabet = string.ascii_uppercase + string.digits
    while True:
        suffix = "".join(secrets.choice(alphabet) for _ in range(BOOKING_CODE_LENGTH))
        code = f"{BOOKING_CODE_PREFIX}{suffix}"
        if not Booking.objects.filter(booking_code=code).exists():
            return code


def _has_overlap(listing_id, check_in: date, check_out: date) -> bool:
    """
    A booking blocks new bookings if:
    - It's accepted/active (paid, real booking) → always blocks
    - It's pending AND not yet expired → blocks (someone might still pay)
    - It's pending AND has no expires_at → blocks (legacy/safety)

    A pending+expired booking does NOT block (treated as abandoned). The query
    naturally ignores stale rows even before the cleanup cron runs.

    A booking overlaps if existing.check_in < new.check_out
                       AND existing.check_out > new.check_in.
    """
    now = timezone.now()
    return Booking.objects.filter(
        listing_id=listing_id,
        check_in_date__lt=check_out,
        check_out_date__gt=check_in,
    ).filter(
        Q(status__in=Booking.BLOCKING_STATUSES) |
        Q(status=Booking.Status.PENDING, expires_at__gt=now) |
        Q(status=Booking.Status.PENDING, expires_at__isnull=True)
    ).exists()


def _validate_dates(check_in: date, check_out: date, *, allow_past: bool = False) -> None:
    """Raise ValidationError if dates are invalid."""
    if check_out <= check_in:
        raise ValidationError({
            "error": "check_out_date must be after check_in_date",
            "code": ErrorCode.INVALID_DATES,
        })
    if not allow_past and check_in < date.today():
        raise ValidationError({
            "error": "check_in_date cannot be in the past",
            "code": ErrorCode.PAST_DATE,
        })


def _get_cancellation_policy(listing: Listing) -> str:
    """Return the listing's cancellation policy or default."""
    if hasattr(listing, "house_rules") and listing.house_rules:
        return listing.house_rules.cancellation_policy
    return DEFAULT_CANCELLATION_POLICY


def _quantize(value: Decimal) -> Decimal:
    """Round a Decimal to two decimal places (paise)."""
    return value.quantize(MONEY_PRECISION)


# ─── Quote ───────────────────────────────────────────────────────────────

def quote_booking(listing_id, check_in: date, check_out: date) -> dict:
    """
    Return a price breakdown for the given listing/dates without creating
    anything. Used by the app to show the guest what they'll pay before
    confirming.
    """
    _validate_dates(check_in, check_out, allow_past=True)

    try:
        listing = Listing.objects.get(id=listing_id, status=Listing.Status.LIVE)
    except Listing.DoesNotExist:
        raise NotFound({
            "error": "Listing not found or not available",
            "code": ErrorCode.LISTING_NOT_FOUND,
        })

    nights = (check_out - check_in).days
    if nights < listing.min_nights:
        raise ValidationError({
            "error": f"Minimum stay is {listing.min_nights} nights",
            "code": ErrorCode.MIN_NIGHTS,
        })
    if nights > listing.max_nights:
        raise ValidationError({
            "error": f"Maximum stay is {listing.max_nights} nights",
            "code": ErrorCode.MAX_NIGHTS,
        })

    host_nightly = listing.host_price_per_night
    gst_per_night = _quantize(host_nightly * listing.gst_pct / PERCENT_DENOMINATOR)
    fee_per_night = _quantize(host_nightly * listing.platform_fee_pct / PERCENT_DENOMINATOR)
    guest_nightly = host_nightly + gst_per_night + fee_per_night

    subtotal = _quantize(host_nightly * nights)
    gst_amount = _quantize(gst_per_night * nights)
    platform_fee = _quantize(fee_per_night * nights)
    security_deposit = listing.security_deposit
    total_guest_pays = _quantize(subtotal + gst_amount + platform_fee + security_deposit)
    total_host_receives = subtotal
    platform_revenue = _quantize(platform_fee + gst_amount)

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


# ─── Create ──────────────────────────────────────────────────────────────

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
    same dates at the same time. Also enforces a DB-level overlap check inside
    the lock (defense in depth).
    """
    _validate_dates(check_in, check_out)

    quote = quote_booking(listing_id, check_in, check_out)
    listing = Listing.objects.select_related("house_rules").get(id=listing_id)

    if listing.host_user_id == user.id:
        raise PermissionDenied({
            "error": "You cannot book your own listing",
            "code": ErrorCode.SELF_BOOKING,
        })

    lock_key = f"book:{listing_id}:{check_in.isoformat()}:{check_out.isoformat()}"

    with distributed_lock(lock_key) as acquired:
        if not acquired:
            raise BookingConflictError("Another guest is currently booking these dates")

        if _has_overlap(listing_id, check_in, check_out):
            raise BookingConflictError("These dates are no longer available")

        cancellation_policy = _get_cancellation_policy(listing)

        host_response_deadline = (
            timezone.now() + timedelta(hours=settings.HOST_RESPONSE_DEADLINE_HOURS)
            if listing.booking_mode == Listing.BookingMode.REQUEST
            else None
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
                host_response_deadline=host_response_deadline,
            )

            BookingStatusHistory.objects.create(
                booking=booking,
                from_status=None,
                to_status=Booking.Status.PENDING,
                changed_by_user=user,
                reason=StatusChangeReason.BOOKING_CREATED,
            )

        logger.info(f"Booking {booking.booking_code} created for guest {user.id}")
        return booking


# ─── Cancellation & refund ───────────────────────────────────────────────

def compute_refund_amount(booking: Booking, cancelled_by: str) -> Decimal:
    """
    Compute refund amount based on cancellation policy and time-to-check-in.

    `cancelled_by` is one of `Booking.CancelledBy` values.

    - If host or system cancels: full refund (including platform fee).
    - If guest cancels: per `REFUND_SCHEDULES[policy]`. Platform fee is
      non-refundable on guest cancellation.
    """
    if cancelled_by in (Booking.CancelledBy.HOST, Booking.CancelledBy.SYSTEM):
        return booking.total_guest_pays

    # Guest cancellation: depends on policy + how close to check-in
    days_to_checkin = (booking.check_in_date - date.today()).days

    base_refundable = booking.subtotal + booking.gst_amount + booking.security_deposit
    policy = booking.cancellation_policy or DEFAULT_CANCELLATION_POLICY
    schedule = REFUND_SCHEDULES.get(policy, REFUND_SCHEDULES[DEFAULT_CANCELLATION_POLICY])

    # Walk thresholds (sorted desc by days remaining); first match wins.
    for threshold_days, percent in schedule:
        if days_to_checkin >= threshold_days:
            return _quantize(base_refundable * percent)

    return Decimal("0")


def cancel_booking(booking: Booking, user: User, reason: str = "") -> Booking:
    """Cancel a booking and trigger refund if applicable."""
    if booking.status in Booking.NON_CANCELLABLE_STATUSES:
        raise ValidationError({
            "error": "Booking cannot be cancelled",
            "code": ErrorCode.INVALID_STATE,
        })

    if user.id == booking.guest_user_id:
        cancelled_by = Booking.CancelledBy.GUEST
        new_status = Booking.Status.CANCELLED_BY_GUEST
        default_reason = StatusChangeReason.CANCELLED_BY_GUEST
    elif user.id == booking.host_user_id:
        cancelled_by = Booking.CancelledBy.HOST
        new_status = Booking.Status.CANCELLED_BY_HOST
        default_reason = StatusChangeReason.CANCELLED_BY_HOST
    else:
        raise PermissionDenied({
            "error": "Not allowed to cancel this booking",
            "code": ErrorCode.FORBIDDEN,
        })

    refund_amount = compute_refund_amount(booking, cancelled_by)

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
            reason=reason or default_reason,
        )

    if booking.payment_status == Booking.PaymentStatus.REFUND_PENDING:
        initiate_refund_for_cancelled_booking(booking, refund_amount, cancelled_by)

    logger.info(
        f"Booking {booking.booking_code} cancelled by {cancelled_by}; "
        f"refund=₹{refund_amount}",
    )
    return booking


# ─── Host queries ────────────────────────────────────────────────────────

# Maps a public filter value to the list of booking statuses it includes.
_HOST_BOOKING_FILTERS: dict[str, tuple[str, ...]] = {
    Booking.HostBookingFilter.ACTIVE: (
        Booking.Status.ACTIVE, Booking.Status.ACCEPTED,
    ),
    Booking.HostBookingFilter.UPCOMING: (
        Booking.Status.PENDING, Booking.Status.ACCEPTED,
    ),
    Booking.HostBookingFilter.COMPLETED: (
        Booking.Status.COMPLETED,
    ),
}


def get_host_bookings(user: User, status_filter: str = Booking.HostBookingFilter.ALL) -> list[dict]:
    """Returns list of bookings for a host, optionally filtered by status."""
    queryset = (
        Booking.objects.filter(host_user=user)
        .select_related("guest_user")
        .order_by("-created_at")
    )

    statuses = _HOST_BOOKING_FILTERS.get(status_filter)
    if statuses:
        queryset = queryset.filter(status__in=statuses)

    return [_booking_to_dict(b) for b in queryset]


def get_host_earnings(user: User) -> dict:
    """Returns lifetime earnings, monthly breakdown, and payout info."""
    completed = Booking.objects.filter(
        host_user=user,
        status__in=[Booking.Status.COMPLETED, Booking.Status.ACTIVE],
    )

    lifetime_agg = completed.aggregate(
        total_earnings=Sum("total_host_receives"),
        total_bookings=Count("id"),
    )
    total_nights = sum(b.nights for b in completed)

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
        "payout": _get_primary_payout(user),
    }


def _get_primary_payout(user: User) -> dict:
    """
    Returns the host's primary payout account in the shape expected by the
    earnings endpoint. Falls back to all-nulls if no account is configured.

    The model is `apps.users.models.PayoutAccount` with `is_primary=True`. If
    no primary is set, the most-recently-created account is used.
    """

    account = (
        PayoutAccount.objects
        .filter(user=user)
        .order_by("-is_primary", "-created_at")
        .first()
    )

    if not account:
        return {
            "bank_name": None,
            "account_last4": None,
            "payout_schedule": None,
            "next_payout_amount": None,
            "next_payout_date": None,
        }

    if account.account_type == PayoutAccount.AccountType.BANK:
        bank_name = account.bank_name
        last4 = account.account_number[-4:] if account.account_number else None
    else:
        bank_name = "UPI"
        last4 = account.upi_id 

    return {
        "bank_name": bank_name,
        "account_last4": last4,
        "payout_schedule": "Weekly",
        "next_payout_amount": None,
        "next_payout_date": None,
    }


def get_booking_detail(booking: Booking) -> dict:
    """Full booking details for the detail screen — for guest or host view."""
    return {
        "booking_id": str(booking.id),
        "booking_code": booking.booking_code,
        "status": booking.status,
        "payment_status": booking.payment_status,
        "booking_mode": booking.booking_mode,
        "check_in_date": booking.check_in_date.isoformat(),
        "check_out_date": booking.check_out_date.isoformat(),
        "nights": booking.nights,
        "number_of_guests": booking.number_of_guests,
        "guest_purpose": booking.guest_purpose,
        "special_requests": booking.special_requests,
        "guest": {
            "id": str(booking.guest_user_id),
            "name": get_display_name(booking.guest_user),
            "initials": get_initials(booking.guest_user),
            "phone": (
                f"{booking.guest_user.phone_country_code}"
                f"{booking.guest_user.phone_number}"
                if booking.guest_user.phone_number else None
            ),
            "email": booking.guest_user.email or None,
        },
        "host": {
            "id": str(booking.host_user_id),
            "name": get_display_name(booking.host_user),
        },
        "listing": {
            "id": str(booking.listing_id),
            "title": booking.listing.title if booking.listing else None,
        },
        "pricing": {
            "host_nightly_price": float(booking.host_nightly_price),
            "guest_nightly_price": float(booking.guest_nightly_price),
            "subtotal": float(booking.subtotal),
            "gst_amount": float(booking.gst_amount),
            "platform_fee": float(booking.platform_fee),
            "security_deposit": float(booking.security_deposit),
            "total_guest_pays": float(booking.total_guest_pays),
            "total_host_receives": float(booking.total_host_receives),
            "currency": booking.currency,
        },
        "cancellation_policy": booking.cancellation_policy,
        "cancelled_at": booking.cancelled_at.isoformat() if booking.cancelled_at else None,
        "cancellation_reason": booking.cancellation_reason,
        "refund_amount": (
            float(booking.refund_amount) if booking.refund_amount is not None else None
        ),
        "created_at": booking.created_at.isoformat(),
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
