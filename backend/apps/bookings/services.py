from django.db.models import Sum, Count
from django.db.models.functions import TruncMonth

from apps.bookings.models import Booking
from apps.users.models import User
from common.utils import get_display_name, get_initials


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