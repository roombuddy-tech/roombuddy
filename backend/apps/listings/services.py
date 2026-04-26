from apps.listings.models import Listing
from apps.properties.models import PropertyPhoto
from apps.users.models import User


def get_host_listings(user: User) -> list[dict]:
    """Returns all listings owned by a host."""
    listings = Listing.objects.filter(
        host_user=user
    ).select_related("property", "room").order_by("-created_at")

    results = [_listing_to_dict(listing) for listing in listings]

    # Batch fetch cover photos
    _attach_cover_photos(listings, results)

    return results


def _listing_to_dict(listing: Listing) -> dict:
    """Convert a Listing model instance to a response dict."""
    return {
        "listing_id": str(listing.id),
        "title": listing.title,
        "area_name": _get_area_name(listing),
        "host_price_per_night": float(listing.host_price_per_night),
        "guest_price_per_night": float(listing.guest_price_per_night),
        "status": listing.status,
        "average_rating": float(listing.average_rating) if listing.average_rating else None,
        "review_count": listing.review_count,
        "total_bookings": listing.total_bookings,
        "cover_photo_url": None,
    }


def _get_area_name(listing: Listing) -> str:
    """Extract a readable area name from the listing's property."""
    try:
        prop = listing.property
        if prop.formatted_address:
            return prop.formatted_address.split(",")[0]
        return prop.apartment_name or prop.city_name
    except Exception:
        return ""


def _attach_cover_photos(listings, results: list[dict]):
    """Batch fetch cover photos and attach to results."""
    if not results:
        return

    listing_property_map = {str(l.id): l.property_id for l in listings}
    property_ids = list(set(listing_property_map.values()))

    photo_map = {
        str(p["property_id"]): p["url"]
        for p in PropertyPhoto.objects.filter(
            property_id__in=property_ids, is_cover=True
        ).values("property_id", "url")
    }

    for r in results:
        prop_id = str(listing_property_map.get(r["listing_id"], ""))
        r["cover_photo_url"] = photo_map.get(prop_id)