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
from apps.notifications.models import EventType
from apps.notifications.services import dispatch

from apps.bookings.models import Booking, BookingStatusHistory
from apps.listings.models import Listing
from apps.payments.services import initiate_refund_for_cancelled_booking
from apps.users.models import User, PayoutAccount
from apps.reviews.models import Review
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
from apps.payments.models import Payout
from apps.properties.models import PropertyPhoto
from third_party.storage import get_photo_url

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
    # if hasattr(listing, "house_rules") and listing.house_rules:
    #     return listing.house_rules.cancellation_policy
    return DEFAULT_CANCELLATION_POLICY


def _quantize(value: Decimal) -> Decimal:
    """Round a Decimal to two decimal places (paise)."""
    return value.quantize(MONEY_PRECISION)


# ─── Quote ───────────────────────────────────────────────────────────────

def quote_booking(listing_id, check_in: date, check_out: date, meal_option: bool = False) -> dict:
    """
    Return a price breakdown for the given listing/dates without creating
    anything. Used by the app to show the guest what they'll pay before
    confirming.
    """
    logger.info("quote_booking listing_id=%s", listing_id)
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

    # ── Early-stage flat pricing ────────────────────────────────────────
    # The guest pays ONLY a small flat platform fee through the app. Rent,
    # security deposit and meals are settled directly with the host (offline),
    # so no rent/GST flows through RoomBuddy.
    host_nightly = listing.host_price_per_night
    guest_nightly = host_nightly  # guest pays rent to host directly at this rate

    subtotal = _quantize(host_nightly * nights)
    gst_amount = Decimal("0")
    platform_fee = _quantize(settings.BOOKING_PLATFORM_FEE)
    host_platform_fee = Decimal("0")
    security_deposit = listing.security_deposit

    # Meal option
    meals_available = listing.food_meals_available
    meal_cost_per_day = listing.food_meal_cost if meals_available else None
    meal_total = Decimal("0")
    if meal_option and meals_available and meal_cost_per_day:
        meal_total = _quantize(meal_cost_per_day * nights)

    # Parse meal types from description
    meal_types = None
    if meals_available and listing.food_meal_description:
        for line in listing.food_meal_description.split("\n"):
            if line.startswith("Meals served: "):
                meal_types = line.replace("Meals served: ", "")
                break

    # What the guest settles directly with the host (not collected by us).
    pay_to_host_directly = _quantize(subtotal + security_deposit + meal_total)
    # What the guest actually pays through the app right now.
    total_guest_pays = platform_fee
    total_host_receives = _quantize(subtotal + meal_total)
    platform_revenue = platform_fee

    return {
        "listing_id": str(listing.id),
        "nights": nights,
        "host_nightly_price": float(host_nightly),
        "guest_nightly_price": float(guest_nightly),
        "subtotal": float(subtotal),
        "gst_amount": float(gst_amount),
        "gst_pct": float(settings.GST_PCT),
        "platform_fee": float(platform_fee),
        "platform_fee_pct": float(settings.GUEST_PLATFORM_FEE_PCT),
        "host_platform_fee": float(host_platform_fee),
        "security_deposit": float(security_deposit),
        "pay_to_host_directly": float(pay_to_host_directly),
        "total_guest_pays": float(total_guest_pays),
        "total_host_receives": float(total_host_receives),
        "platform_revenue": float(platform_revenue),
        "currency": listing.currency,
        "booking_mode": listing.booking_mode,
        "meals_available": meals_available,
        "meal_cost_per_day": float(meal_cost_per_day) if meal_cost_per_day else None,
        "meal_total": float(meal_total) if meal_total else None,
        "meal_option": meal_option,
        "meal_types": meal_types,
        "cancellation_policy": _get_cancellation_policy(listing),
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
    meal_option: bool = False,
) -> Booking:
    """
    Create a booking row in `pending` state.

    Wrapped in a Redis distributed lock to prevent two guests from booking the
    same dates at the same time. Also enforces a DB-level overlap check inside
    the lock (defense in depth).
    """
    logger.info("create_booking user_id=%s listing_id=%s", getattr(user, "id", None), listing_id)
    _validate_dates(check_in, check_out)

    quote = quote_booking(listing_id, check_in, check_out, meal_option=meal_option)
    listing = Listing.objects.select_related("house_rules").get(id=listing_id)
    nights = (check_out - check_in).days


    if listing.host_user_id == user.id:
        raise PermissionDenied({
            "error": "You cannot book your own listing",
            "code": ErrorCode.SELF_BOOKING,
        })

    # ── Gender preference validation ──────────────────────────────────────
    gender_pref = listing.property.gender_preference
    if gender_pref and gender_pref != "any":
        try:
            guest_gender = user.profile.gender
        except Exception:
            guest_gender = None

        allowed = {
            "male_only": ["male"],
            "female_only": ["female"],
        }
        allowed_genders = allowed.get(gender_pref, [])

        if guest_gender not in allowed_genders:
            pref_label = "female guests only" if gender_pref == "female_only" else "male guests only"
            raise ValidationError({
                "error": f"This property is listed for {pref_label}. Your profile gender does not match.",
                "code": ErrorCode.GENDER_MISMATCH,
            })
    

    lock_key = f"book:{listing_id}:{check_in.isoformat()}:{check_out.isoformat()}"

    with distributed_lock(lock_key) as acquired:
        if not acquired:
            logger.warning("create_booking: lock contended for listing %s", listing_id)
            raise BookingConflictError("Another guest is currently booking these dates")

        if _has_overlap(listing_id, check_in, check_out):
            logger.warning("create_booking: dates unavailable for listing %s", listing_id)
            raise BookingConflictError("These dates are no longer available")

        cancellation_policy = _get_cancellation_policy(listing)

        host_response_deadline = (
            timezone.now() + timedelta(hours=settings.HOST_RESPONSE_DEADLINE_HOURS)
            if listing.booking_mode == Listing.BookingMode.REQUEST
            else None
        )

        with transaction.atomic():

            guest_profile = getattr(user, "profile", None)
            guest_name = ""
            guest_gender = ""
            guest_email = getattr(user, "email", "") or ""
            guest_phone = getattr(user, "mobile_number", "") or ""
            if guest_profile:
                first = getattr(guest_profile, "first_name", "") or ""
                last = getattr(guest_profile, "last_name", "") or ""
                guest_name = f"{first} {last}".strip()
                guest_gender = getattr(guest_profile, "gender", "") or ""
            

            booking = Booking.objects.create(
                booking_code=_generate_booking_code(),
                listing=listing,
                guest_user=user,
                host_user=listing.host_user,
                guest_name=guest_name,
                guest_email=guest_email,
                guest_phone=guest_phone,
                guest_gender=guest_gender,
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
                host_platform_fee=Decimal(str(quote["host_platform_fee"])),
                security_deposit=Decimal(str(quote["security_deposit"])),
                total_guest_pays=Decimal(str(quote["total_guest_pays"])),
                total_host_receives=Decimal(str(quote["total_host_receives"])),
                platform_revenue=Decimal(str(quote["platform_revenue"])),
                currency=quote["currency"],
                meal_option_selected=meal_option,
                meal_cost_per_day=Decimal(str(quote["meal_cost_per_day"])) if quote["meal_cost_per_day"] else None,
                meal_total=Decimal(str(quote["meal_total"])) if quote["meal_total"] else None,
                cancellation_policy=cancellation_policy,
                host_response_deadline=host_response_deadline,
                expires_at=timezone.now() + timedelta(minutes=10),
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
    Compute refund of the amount collected through the app.

    Under flat pricing the guest only pays the platform fee (`total_guest_pays`)
    online; rent, deposit and meals are settled directly with the host and are
    therefore not ours to refund.

    - Host or system cancels  → refund the platform fee in full.
    - Guest cancels           → platform fee is non-refundable (₹0).
    """
    if cancelled_by in (Booking.CancelledBy.HOST, Booking.CancelledBy.SYSTEM):
        return booking.total_guest_pays

    # Guest cancellation: the platform fee is non-refundable.
    return Decimal("0")


def cancel_booking(booking: Booking, user: User, reason: str = "") -> Booking:
    """Cancel a booking and trigger refund if applicable."""
    logger.info("cancel_booking booking_id=%s user_id=%s reason=%s", getattr(booking, "id", None), getattr(user, "id", None), reason)
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
    _notify_booking_cancelled(booking, cancelled_by)
    return booking

def _user_first_name(user) -> str:
    """Safely get a user's first name from their profile; falls back to 'there'."""
    if not user:
        return "there"
    profile = getattr(user, "profile", None)
    if profile and profile.first_name:
        return profile.first_name
    return "there"


def _notify_booking_cancelled(booking, cancelled_by: str) -> None:
    from apps.payments.services import _build_booking_context

    base = _build_booking_context(booking)
    base["refund_amount"] = f"{booking.refund_amount:,.0f}" if booking.refund_amount else ""
    base["rejection_reason"] = booking.cancellation_reason or ""

    guest_name = booking.guest_name or ""
    if not guest_name:
        gp = getattr(booking.guest_user, "profile", None)
        if gp:
            guest_name = f"{gp.first_name or ''} {gp.last_name or ''}".strip()
    base["guest_name"] = guest_name or "A guest"

    if cancelled_by == Booking.CancelledBy.GUEST:
        if booking.host_user:
            dispatch(
                event_type=EventType.BOOKING_GUEST_CANCELLED,
                recipients=[booking.host_user],
                context={
                    **base,
                    "recipient_name": _user_first_name(booking.host_user),
                },
                idempotency_event_id=f"cancelled:{booking.id}:host_notif",
            )
        if booking.guest_user:
            dispatch(
                event_type=EventType.BOOKING_GUEST_CANCELLED,
                recipients=[booking.guest_user],
                context={
                    **base,
                    "recipient_name": _user_first_name(booking.guest_user),
                },
                idempotency_event_id=f"cancelled:{booking.id}:guest_confirm",
            )

    elif cancelled_by == Booking.CancelledBy.HOST:
        if booking.guest_user:
            dispatch(
                event_type=EventType.BOOKING_HOST_CANCELLED,
                recipients=[booking.guest_user],
                context={
                    **base,
                    "recipient_name": _user_first_name(booking.guest_user),
                },
                idempotency_event_id=f"cancelled:{booking.id}:guest_notif",
            )
        if booking.host_user:
            dispatch(
                event_type=EventType.BOOKING_HOST_CANCELLED,
                recipients=[booking.host_user],
                context={
                    **base,
                    "recipient_name": _user_first_name(booking.host_user),
                },
                idempotency_event_id=f"cancelled:{booking.id}:host_confirm",
            )

# ─── Host queries ────────────────────────────────────────────────────────

# Maps a public filter value to the list of booking statuses it includes.
_HOST_BOOKING_FILTERS: dict[str, tuple[str, ...]] = {
    Booking.HostBookingFilter.ACTIVE: (
        Booking.Status.ACTIVE,
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

    if status_filter == Booking.HostBookingFilter.UPCOMING:
        queryset = queryset.filter(payment_status=Booking.PaymentStatus.PAID)

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

    # Payout summary
    total_paid = Payout.objects.filter(
        host_user=user, status=Payout.Status.COMPLETED,
    ).aggregate(total=Sum("amount"))["total"] or 0
    pending_payout = Payout.objects.filter(
        host_user=user, status=Payout.Status.PENDING,
    ).aggregate(total=Sum("amount"))["total"] or 0
    last_payout = Payout.objects.filter(
        host_user=user, status=Payout.Status.COMPLETED,
    ).order_by("-completed_at").first()

    return {
        "lifetime": {
            "total_earnings": float(lifetime_agg["total_earnings"] or 0),
            "total_bookings": lifetime_agg["total_bookings"] or 0,
            "total_nights": total_nights,
        },
        "monthly": monthly,
        "payout": _get_primary_payout(user),
        "payout_summary": {
            "total_paid_out": float(total_paid),
            "pending_amount": float(pending_payout),
            "unpaid_amount": float((lifetime_agg["total_earnings"] or 0) - total_paid - pending_payout),
            "last_payout_date": last_payout.completed_at.isoformat() if last_payout and last_payout.completed_at else None,
            "last_payout_amount": float(last_payout.amount) if last_payout else None,
        },
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
            "meal_option_selected": booking.meal_option_selected,
            "meal_cost_per_day": float(booking.meal_cost_per_day) if booking.meal_cost_per_day else None,
            "meal_total": float(booking.meal_total) if booking.meal_total else None,
        },
        "cancellation_policy": booking.cancellation_policy,
        "cancelled_at": booking.cancelled_at.isoformat() if booking.cancelled_at else None,
        "cancellation_reason": booking.cancellation_reason,
        "refund_amount": (
            float(booking.refund_amount) if booking.refund_amount is not None else None
        ),
        "created_at": booking.created_at.isoformat(),
    }



def get_guest_bookings(user: User) -> list[dict]:
    """Returns all bookings for a guest, newest first, with listing/host info."""

    bookings = (
        Booking.objects.filter(guest_user=user)
        .select_related("host_user", "listing__property")
        .order_by("-created_at")
    )

    property_ids = [b.listing.property_id for b in bookings if b.listing]
    photo_map: dict[str, str] = {}
    if property_ids:
        photo_map = {
            str(p["property_id"]): p["url"]
            for p in PropertyPhoto.objects.filter(
                property_id__in=property_ids, is_cover=True
            ).values("property_id", "url")
        }

    results = []
    for b in bookings:
        prop = b.listing.property if b.listing else None
        raw_url = photo_map.get(str(prop.id)) if prop else None
        results.append({
            "booking_id": str(b.id),
            "booking_code": b.booking_code,
            "listing_id": str(b.listing_id) if b.listing_id else None,
            "listing_title": b.listing.title if b.listing else None,
            "area_name": prop.address_line1 if prop else None,
            "city": prop.city_name if prop else None,
            "cover_photo_url": get_photo_url(raw_url) if raw_url else None,
            "host_name": get_display_name(b.host_user),
            "host_phone": (
                f"{b.host_user.phone_country_code}{b.host_user.phone_number}"
                if b.host_user.phone_number else None
            ),
            "check_in_date": b.check_in_date.isoformat(),
            "check_out_date": b.check_out_date.isoformat(),
            "nights": b.nights,
            "status": b.status,
            "payment_status": b.payment_status,
            "total_guest_pays": float(b.total_guest_pays),
            "can_review": b.status == Booking.Status.COMPLETED,
            "has_reviewed": False,
            "created_at": b.created_at.isoformat(),
        })

    # backfill has_reviewed in one query
    reviewed_ids = set(
        Review.objects.filter(
            booking_id__in=[b["booking_id"] for b in results],
            review_type=Review.ReviewType.GUEST_TO_HOST,
        ).values_list("booking_id", flat=True)
    )
    for r in results:
        if r["can_review"]:
            r["has_reviewed"] = str(r["booking_id"]) in {str(i) for i in reviewed_ids}
    return results

def accept_booking(booking: Booking, host: User) -> Booking:
    """Host accepts a pending booking."""
    logger.info("accept_booking booking_id=%s host_id=%s", booking.id, host.id)
    if booking.payment_status != Booking.PaymentStatus.PAID:
        raise ValidationError({"error": "Cannot accept a booking that has not been paid for."})
    with transaction.atomic():
        booking.status = Booking.Status.ACCEPTED
        booking.host_responded_at = timezone.now()
        booking.save(update_fields=["status", "host_responded_at", "updated_at"])
        BookingStatusHistory.objects.create(
            booking=booking,
            from_status=Booking.Status.PENDING,
            to_status=Booking.Status.ACCEPTED,
            changed_by_user=host,
        )
        _notify_host_responded(booking, accepted=True)
    return booking


def reject_booking(booking: Booking, host: User, reason: str = "") -> Booking:
    """Host declines a pending booking."""
    logger.info("reject_booking booking_id=%s host_id=%s", booking.id, host.id)
    with transaction.atomic():
        booking.status = Booking.Status.REJECTED
        booking.host_responded_at = timezone.now()
        booking.cancellation_reason = reason or None
        booking.save(update_fields=["status", "host_responded_at", "cancellation_reason", "updated_at"])
        BookingStatusHistory.objects.create(
            booking=booking,
            from_status=Booking.Status.PENDING,
            to_status=Booking.Status.REJECTED,
            changed_by_user=host,
        )
        _notify_host_responded(booking, accepted=False)
    return booking


def _notify_host_responded(booking: Booking, accepted: bool) -> None:
    """Fire notification to the guest when host accepts or rejects."""
    from apps.notifications.services import dispatch
    from apps.notifications.models import EventType
    from apps.payments.services import _build_booking_context, _send_invoice_email
    try:
        event = (
            EventType.BOOKING_HOST_ACCEPTED if accepted
            else EventType.BOOKING_HOST_REJECTED
        )
        # Use the canonical context builder so every price field
        # (platform_fee, pay_to_host_directly, meal_total, security_deposit …)
        # is present and consistent across email/PDF.
        base = _build_booking_context(booking)
        dispatch(
            event_type=event,
            recipients=[booking.guest_user],
            context={
                **base,
                "recipient_name": _user_first_name(booking.guest_user),
            },
            idempotency_event_id=f"host_respond:{booking.id}:{'accept' if accepted else 'reject'}",
        )

        if accepted:
            _send_invoice_email(booking, booking.guest_user, base)
    except Exception:
        logger.exception("_notify_host_responded failed booking_id=%s", booking.id)


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