from datetime import datetime

from django.db import transaction

from apps.amenities.models import AmenityDefinition
from apps.listings.models import Listing, ListingAmenity, ListingHouseRules
from apps.listings.serializers import CreateListingRequestSerializer
from apps.properties.models import Property, PropertyFlatmate
from apps.rooms.models import Room
from apps.users.models import User


def get_host_listings(user: User) -> list[dict]:
    """Returns all listings owned by a host."""
    from apps.properties.models import PropertyPhoto

    listings = Listing.objects.filter(
        host_user=user
    ).select_related("property", "room").order_by("-created_at")

    results = [_listing_to_dict(listing) for listing in listings]
    _attach_cover_photos(listings, results)
    return results


def create_listing(user: User, data: dict) -> dict:
    """Create a full listing atomically from wizard form data."""
    serializer = CreateListingRequestSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    d = serializer.validated_data

    with transaction.atomic():
        prop_data = d["property"]
        prop = Property.objects.create(
            host_user=user,
            apartment_type=prop_data["apartment_type"],
            floor_number=prop_data["floor_number"],
            total_floors=prop_data.get("total_floors"),
            apartment_name=prop_data["apartment_name"],
            address_line1=prop_data.get("address_line1", ""),
            city_name=prop_data["city_name"],
            gender_preference=prop_data["gender_preference"],
            title=d["title"],
            description=d.get("description", ""),
            status=Property.Status.DRAFT,
        )

        for fm in d.get("flatmates", []):
            PropertyFlatmate.objects.create(
                property=prop,
                name=fm["name"],
                age=fm.get("age"),
                occupation=fm.get("occupation", ""),
                hobbies=fm.get("hobbies", ""),
            )

        room_data = d["room"]
        room = Room.objects.create(
            property=prop,
            room_type=room_data["room_type"],
            bed_type=room_data["bed_type"],
            bathroom_type=room_data["bathroom_type"],
            room_size_sqft=room_data.get("room_size_sqft"),
            room_features=room_data.get("room_features", []),
        )

        listing = Listing.objects.create(
            host_user=user,
            property=prop,
            room=room,
            title=d["title"],
            description=d.get("description", ""),
            host_price_per_night=d["host_price_per_night"],
            min_nights=d.get("min_nights", 1),
            food_kitchen_access=d.get("food_kitchen_access", False),
            food_meals_available=d.get("food_meals_available", False),
            status=Listing.Status.DRAFT,
        )

        amenity_names = d.get("amenities", [])
        if amenity_names:
            amenity_defs = AmenityDefinition.objects.filter(display_name__in=amenity_names)
            ListingAmenity.objects.bulk_create([
                ListingAmenity(listing=listing, amenity=amenity)
                for amenity in amenity_defs
            ])

        rules = d["house_rules"]
        extra_rules = _build_extra_rules(rules)
        custom_text = rules.get("custom_rules", "").strip()
        combined_rules = "\n".join(filter(None, [extra_rules, custom_text])) or None

        ListingHouseRules.objects.create(
            listing=listing,
            no_smoking=rules.get("no_smoking", False),
            no_loud_music_after=_parse_time(rules["check_in_time"]),
            no_pets=rules.get("no_pets", False),
            no_alcohol=rules.get("no_alcohol", False),
            custom_rules=combined_rules,
            cancellation_policy=rules.get("cancellation_policy", "moderate"),
            check_in_from=_parse_time(rules["check_in_time"]),
            check_out_by=_parse_time(rules["check_out_time"]),
        )

    return {
        "listing_id": str(listing.id),
        "status": listing.status,
        "message": "Listing submitted for review.",
    }


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _parse_time(time_str: str) -> str:
    """Convert '2:00 PM' → '14:00' for Django TimeField."""
    try:
        dt = datetime.strptime(time_str.strip(), "%I:%M %p")
        return dt.strftime("%H:%M")
    except (ValueError, AttributeError):
        return "12:00"


def _build_extra_rules(rules: dict) -> str:
    """Pack the four extra wizard toggles into a human-readable string."""
    lines = []
    if rules.get("no_parties"):
        lines.append("No parties or events")
    if rules.get("shoes_off"):
        lines.append("Please remove shoes at the entrance")
    if rules.get("kitchen_clean"):
        lines.append("Please keep the kitchen clean after use")
    if rules.get("lock_door"):
        lines.append("Please lock the main door when leaving")
    return "\n".join(lines)


def _listing_to_dict(listing: Listing) -> dict:
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
    try:
        prop = listing.property
        if prop.formatted_address:
            return prop.formatted_address.split(",")[0]
        return prop.apartment_name or prop.city_name
    except Exception:
        return ""


def _attach_cover_photos(listings, results: list[dict]):
    from apps.properties.models import PropertyPhoto

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
