import logging
from django.db import transaction
from django.db.models import Avg
from django.utils import timezone

from apps.bookings.models import Booking
from apps.listings.models import Listing
from apps.reviews.models import Review

logger = logging.getLogger(__name__)


# ─── Eligibility ──────────────────────────────────────────────────────────────

def can_guest_review(booking: Booking, guest) -> dict:
    """Returns {eligible, reason} for the guest-to-host review."""
    if booking.guest_user_id != guest.id:
        return {"eligible": False, "reason": "not_your_booking"}
    if booking.status != Booking.Status.COMPLETED:
        return {"eligible": False, "reason": "booking_not_completed"}
    if Review.objects.filter(booking=booking, review_type=Review.ReviewType.GUEST_TO_HOST).exists():
        return {"eligible": False, "reason": "already_reviewed"}
    return {"eligible": True, "reason": None}


# ─── Submit ───────────────────────────────────────────────────────────────────

def submit_guest_review(booking: Booking, guest, data: dict) -> dict:
    """
    Guest submits a review for a completed stay.
    Reviews a single booking; covers both the listing and the host.
    """
    logger.info("submit_guest_review booking_id=%s guest_id=%s", booking.id, guest.id)

    eligibility = can_guest_review(booking, guest)
    if not eligibility["eligible"]:
        raise ValueError(eligibility["reason"])

    with transaction.atomic():
        review = Review.objects.create(
            booking=booking,
            reviewer_user=guest,
            reviewee_user=booking.host_user,
            listing=booking.listing,
            review_type=Review.ReviewType.GUEST_TO_HOST,
            overall_rating=data["overall_rating"],
            cleanliness_rating=data.get("cleanliness_rating"),
            accuracy_rating=data.get("accuracy_rating"),
            communication_rating=data.get("communication_rating"),
            location_rating=data.get("location_rating"),
            value_rating=data.get("value_rating"),
            food_rating=data.get("food_rating"),
            title=data.get("title", "").strip() or None,
            body=data.get("body", "").strip() or None,
            revealed_at=timezone.now(),
        )
        _update_listing_rating(booking.listing)

    logger.info("review %s created for booking %s", review.id, booking.id)
    return _review_to_dict(review)


# ─── Read ─────────────────────────────────────────────────────────────────────

def get_listing_reviews(listing_id: str, limit: int = 20, offset: int = 0) -> dict:
    """Public reviews shown on the listing detail page."""
    qs = (
        Review.objects
        .filter(
            listing_id=listing_id,
            review_type=Review.ReviewType.GUEST_TO_HOST,
            is_hidden=False,
        )
        .select_related("reviewer_user__profile")
        .order_by("-submitted_at")
    )
    total = qs.count()
    reviews = [_review_to_dict(r) for r in qs[offset: offset + limit]]

    agg = qs.aggregate(
        avg_overall=Avg("overall_rating"),
        avg_cleanliness=Avg("cleanliness_rating"),
        avg_accuracy=Avg("accuracy_rating"),
        avg_communication=Avg("communication_rating"),
        avg_location=Avg("location_rating"),
        avg_value=Avg("value_rating"),
        avg_food=Avg("food_rating"),
    )

    def _r(v):
        return round(float(v), 1) if v is not None else None

    return {
        "total": total,
        "average_rating": _r(agg["avg_overall"]),
        "breakdown": {
            "cleanliness": _r(agg["avg_cleanliness"]),
            "accuracy": _r(agg["avg_accuracy"]),
            "communication": _r(agg["avg_communication"]),
            "location": _r(agg["avg_location"]),
            "value": _r(agg["avg_value"]),
            "food": _r(agg["avg_food"]),
        },
        "reviews": reviews,
    }


def get_my_review_for_booking(booking: Booking, guest) -> dict | None:
    """Returns the guest's own review for a booking, or None."""
    try:
        r = Review.objects.select_related("reviewer_user__profile").get(
            booking=booking,
            reviewer_user=guest,
            review_type=Review.ReviewType.GUEST_TO_HOST,
        )
        return _review_to_dict(r)
    except Review.DoesNotExist:
        return None


# ─── Denorm ───────────────────────────────────────────────────────────────────

def _update_listing_rating(listing: Listing) -> None:
    """Recalculate and persist average_rating + review_count on the listing."""
    agg = (
        Review.objects
        .filter(listing=listing, review_type=Review.ReviewType.GUEST_TO_HOST, is_hidden=False)
        .aggregate(avg=Avg("overall_rating"), cnt=models_count())
    )
    listing.average_rating = round(agg["avg"], 2) if agg["avg"] else None
    listing.review_count = agg["cnt"] or 0
    listing.save(update_fields=["average_rating", "review_count"])


def models_count():
    from django.db.models import Count
    return Count("id")


# ─── Serialise ────────────────────────────────────────────────────────────────

def _review_to_dict(r: Review) -> dict:
    from common.utils import get_display_name, get_initials
    try:
        photo = r.reviewer_user.profile.profile_photo_url or None
        if photo:
            from third_party.storage import get_photo_url
            photo = get_photo_url(photo)
    except Exception:
        photo = None

    return {
        "id": str(r.id),
        "booking_id": str(r.booking_id),
        "reviewer_name": get_display_name(r.reviewer_user),
        "reviewer_initials": get_initials(r.reviewer_user),
        "reviewer_photo_url": photo,
        "review_type": r.review_type,
        "overall_rating": r.overall_rating,
        "cleanliness_rating": r.cleanliness_rating,
        "accuracy_rating": r.accuracy_rating,
        "communication_rating": r.communication_rating,
        "location_rating": r.location_rating,
        "value_rating": r.value_rating,
        "food_rating": r.food_rating,
        "title": r.title,
        "body": r.body,
        "submitted_at": r.submitted_at.isoformat(),
        "host_response": r.host_response,
        "host_responded_at": r.host_responded_at.isoformat() if r.host_responded_at else None,
    }
