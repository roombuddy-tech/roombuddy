from datetime import datetime

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.db.models import Count, Q

from apps.amenities.models import AmenityDefinition
from apps.listings.models import Listing, ListingAmenity, ListingBlockedDate, ListingHouseRules
from apps.listings.serializers import CreateListingRequestSerializer
from apps.properties.models import Property, PropertyFlatmate
from apps.rooms.models import Room
from apps.users.models import User, UserProfile
from apps.properties.models import PropertyPhoto
import logging
import math
from datetime import date as date_type
from urllib.parse import urlparse
from third_party.storage import get_photo_url, delete_image
from third_party.maps import geocode_address


def _age_from_dob(dob) -> int | None:
    """Whole years from a date of birth, or None if not available."""
    if not dob:
        return None
    from datetime import date
    today = date.today()
    years = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return years if 0 < years < 120 else None


# Amenities are matched by display name, so a renamed amenity would silently
# stop matching for clients still running the old app build. Map the old name
# onto the new one until those builds age out.
_AMENITY_ALIASES = {
    "Water purifier": "RO / Water purifier",
}


def _resolve_amenity_names(names) -> list[str]:
    return [_AMENITY_ALIASES.get(n, n) for n in (names or [])]


def _photo_storage_key(url: str) -> str:
    """Stable key for a photo URL — strips the domain and any presign query
    string so a client's (signed) URL matches the stored (unsigned) URL."""
    return urlparse(url or "").path.lstrip("/")


def _sync_property_photos(prop, kept_photo_urls) -> None:
    """Delete any of a property's photos that the host removed while editing.

    `kept_photo_urls` is the list of photo URLs the host still wants. Any
    existing PropertyPhoto not in that list is deleted (DB row + storage file).
    If the cover photo was removed, the first remaining photo becomes the cover.
    """
    kept_keys = {_photo_storage_key(u) for u in (kept_photo_urls or [])}
    existing = list(PropertyPhoto.objects.filter(property=prop))
    to_delete = [p for p in existing if _photo_storage_key(p.url) not in kept_keys]
    if not to_delete:
        return

    cover_removed = any(p.is_cover for p in to_delete)
    for p in to_delete:
        try:
            delete_image(_photo_storage_key(p.url))
        except Exception:
            logger.exception("Failed to delete storage file for photo %s", p.id)
        p.delete()

    if cover_removed and not PropertyPhoto.objects.filter(property=prop, is_cover=True).exists():
        nxt = PropertyPhoto.objects.filter(property=prop).order_by("sort_order", "uploaded_at").first()
        if nxt:
            nxt.is_cover = True
            nxt.save(update_fields=["is_cover"])

logger = logging.getLogger(__name__)



def get_listing_form_data(user: User, listing_id: str) -> dict | None:
    """Returns full wizard-compatible form data for editing an existing listing."""
    try:
        listing = (
            Listing.objects
            .select_related("property", "room", "house_rules")
            .get(id=listing_id, host_user=user)
        )
    except Listing.DoesNotExist:
        return None

    prop = listing.property
    room = listing.room

    amenity_names = list(
        listing.listing_amenities.select_related("amenity")
        .values_list("amenity__display_name", flat=True)
    )

    flatmates_qs = list(
        PropertyFlatmate.objects.filter(property=prop)
        .values("id", "name", "age", "gender", "occupation", "hobbies", "hometown")
    )

    rules = getattr(listing, "house_rules", None)
    no_parties = shoes_off = kitchen_clean = lock_door = False
    custom_rules_clean = ""
    if rules and rules.custom_rules:
        remaining = []
        for line in rules.custom_rules.split("\n"):
            stripped = line.strip()
            if stripped == "No parties or events":
                no_parties = True
            elif stripped == "Please remove shoes at the entrance":
                shoes_off = True
            elif stripped == "Please keep the kitchen clean after use":
                kitchen_clean = True
            elif stripped == "Please lock the main door when leaving":
                lock_door = True
            elif stripped:
                remaining.append(stripped)
        custom_rules_clean = "\n".join(remaining)

    meal_types: list[str] = []
    meal_desc_clean = ""
    if listing.food_meal_description:
        lines = listing.food_meal_description.split("\n")
        desc_lines = []
        for line in lines:
            if line.startswith("Meals served: "):
                meal_types = [t.strip() for t in line[len("Meals served: "):].split(",")]
            else:
                desc_lines.append(line)
        meal_desc_clean = "\n".join(desc_lines).strip()

    host_fm = next((f for f in flatmates_qs if f["name"] == "__host__"), None)
    real_flatmates = [f for f in flatmates_qs if f["name"] != "__host__"]


    # Area key → frontend category key
    area_to_frontend = {
        "bedroom": "bedroom",
        "washroom": "bathroom",
        "kitchen": "kitchen",
        "living_room": "living",
        "other": "other",
    }
    photos_by_category: dict[str, list[str]] = {k: [] for k in area_to_frontend.values()}
    for photo in PropertyPhoto.objects.filter(property=prop).order_by("sort_order", "uploaded_at"):
        cat = area_to_frontend.get(photo.area, "other")
        photos_by_category[cat].append(get_photo_url(photo.url))

    return {
        "status": listing.status,
        "property": {
            "apartment_type": prop.apartment_type,
            "floor_number": prop.floor_number,
            "total_floors": prop.total_floors,
            "apartment_name": prop.apartment_name,
            "address_line1": prop.address_line1 or "",
            "city_name": prop.city_name,
            "gender_preference": prop.gender_preference,
            "latitude": float(prop.latitude) if prop.latitude else None,
            "longitude": float(prop.longitude) if prop.longitude else None,
            "google_place_id": prop.google_place_id or "",
            "formatted_address": prop.formatted_address or "",
            "state": prop.state or "",
            "pincode": prop.pincode,
        },
        "room": {
            "room_type": room.room_type,
            "bed_type": room.bed_type,
            "bathroom_type": room.bathroom_type,
            "room_features": room.room_features if isinstance(room.room_features, list) else [],
        },
        "flatmates": [
            {
                "id": str(f["id"]),
                "name": f["name"],
                "age": f["age"],
                "gender": f["gender"] or "",
                "occupation": f["occupation"] or "",
                "hobbies": f["hobbies"] or "",
                "hometown": f["hometown"] or "",
            }
            for f in real_flatmates
        ],
        "amenities": amenity_names,
        "title": listing.title,
        "description": listing.description or "",
        **_pricing_dict(listing),
        "food_kitchen_access": listing.food_kitchen_access,
        "food_meals_available": listing.food_meals_available,
        "food_meal_cost": float(listing.food_meal_cost) if listing.food_meal_cost else None,
        "food_meal_description": meal_desc_clean,
        "food_meal_types": meal_types,
        "house_rules": {
            "no_smoking": rules.no_smoking if rules else True,
            "no_loud_music": True,
            "no_pets": rules.no_pets if rules else True,
            "no_alcohol": rules.no_alcohol if rules else False,
            "no_parties": no_parties,
            "shoes_off": shoes_off,
            "kitchen_clean": kitchen_clean,
            "lock_door": lock_door,
            "custom_rules": custom_rules_clean,
            "cancellation_policy": rules.cancellation_policy if rules else "moderate",
            "check_in_time": _format_time(rules.check_in_from) if rules else "",
            "check_out_time": _format_time(rules.check_out_by) if rules else "",
        },
        "host": {
            "age": (host_fm["age"] if host_fm else None)
            or _age_from_dob(getattr(getattr(listing.host_user, "profile", None), "date_of_birth", None)),
            "occupation": host_fm["occupation"] if host_fm else "",
            "hobbies": host_fm["hobbies"] if host_fm else "",
            "gender": host_fm["gender"] if host_fm else "",
            "hometown": host_fm["hometown"] if host_fm else "",
        },
        "photos": photos_by_category,
        "blocked_dates": [
            {"start_date": bd.start_date.isoformat(), "end_date": bd.end_date.isoformat(), "reason": bd.reason or ""}
            for bd in ListingBlockedDate.objects.filter(listing=listing)
        ],
    }


def update_listing(user: User, listing_id: str, data: dict) -> dict | None:
    """Update all fields of an existing listing atomically."""
    logger.info("update_listing user_id=%s listing_id=%s", getattr(user, "id", None), listing_id)
    serializer = CreateListingRequestSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    d = serializer.validated_data

    try:
        listing = (
            Listing.objects
            .select_related("property", "room", "house_rules")
            .get(id=listing_id, host_user=user)
        )
    except Listing.DoesNotExist:
        return None

    with transaction.atomic():
        prop = listing.property
        prop_data = d["property"]
        prop.apartment_type = prop_data["apartment_type"]
        prop.floor_number = prop_data["floor_number"]
        prop.total_floors = prop_data.get("total_floors")
        prop.apartment_name = prop_data["apartment_name"]
        prop.address_line1 = prop_data.get("address_line1", "")
        prop.city_name = prop_data["city_name"]
        prop.gender_preference = prop_data["gender_preference"]
        prop.latitude = prop_data.get("latitude")
        prop.longitude = prop_data.get("longitude")
        prop.google_place_id = prop_data.get("google_place_id", "")
        prop.formatted_address = prop_data.get("formatted_address", "")
        prop.state = prop_data.get("state", "")
        prop.pincode = prop_data.get("pincode")
        prop.title = d["title"]
        prop.description = d.get("description", "")
        prop.save()

        if not prop.latitude:
            geo = geocode_address(f"{prop.address_line1}, {prop.city_name}")
            if geo:
                prop.latitude = geo["latitude"]
                prop.longitude = geo["longitude"]
                prop.formatted_address = geo["formatted_address"]
                prop.google_place_id = geo.get("google_place_id", "")
                prop.save(update_fields=["latitude", "longitude", "formatted_address", "google_place_id"])

        # Remove any photos the host deleted while editing (kept list from client).
        if "kept_photo_urls" in data:
            kept = data.get("kept_photo_urls") or []
            logger.info("update_listing photo sync: %d kept_photo_urls received", len(kept))
            _sync_property_photos(prop, kept)
        else:
            logger.info("update_listing: no kept_photo_urls in payload — skipping photo sync")

        if "flatmates" in data:
            incoming = d.get("flatmates", [])
            incoming = [fm for fm in incoming if (fm.get("name") or "").strip()]
            PropertyFlatmate.objects.filter(property=prop).delete()
            for fm in incoming:
                PropertyFlatmate.objects.create(
                    property=prop,
                    name=fm["name"],
                    age=fm.get("age"),
                    gender=fm.get("gender", "") or None,
                    occupation=fm.get("occupation", ""),
                    hobbies=fm.get("hobbies", ""),
                    hometown=fm.get("hometown", ""),
                )
        else:
            logger.info("update_listing: no flatmates in payload — leaving existing rows intact")

        room = listing.room
        room_data = d["room"]
        room.room_type = room_data["room_type"]
        room.bed_type = room_data["bed_type"]
        room.bathroom_type = room_data["bathroom_type"]

        room.room_features = room_data.get("room_features", [])
        room.save()

        meal_desc = _build_meal_description(d)
        listing.title = d["title"]
        listing.description = d.get("description", "")
        _apply_pricing_fields(listing, d)
        listing.food_kitchen_access = d.get("food_kitchen_access", False)
        listing.food_meals_available = d.get("food_meals_available", False)
        listing.food_meal_cost = d.get("food_meal_cost")
        listing.food_meal_description = meal_desc or None
        if listing.status == Listing.Status.PENDING and _listing_status_for_user(user) == Listing.Status.LIVE:
            listing.status = Listing.Status.LIVE
            listing.published_at = timezone.now()
        listing.save()

        ListingAmenity.objects.filter(listing=listing).delete()
        amenity_names = d.get("amenities", [])
        if amenity_names:
            amenity_defs = AmenityDefinition.objects.filter(display_name__in=_resolve_amenity_names(amenity_names))
            ListingAmenity.objects.bulk_create([
                ListingAmenity(listing=listing, amenity=amenity)
                for amenity in amenity_defs
            ])

        rules_data = d["house_rules"]
        extra_rules = _build_extra_rules(rules_data)
        custom_text = rules_data.get("custom_rules", "").strip()
        combined_rules = "\n".join(filter(None, [extra_rules, custom_text])) or None

        hr = listing.house_rules
        hr.no_smoking = rules_data.get("no_smoking", False)
        hr.no_loud_music_after = _parse_time(rules_data["check_in_time"])
        hr.no_pets = rules_data.get("no_pets", False)
        hr.no_alcohol = rules_data.get("no_alcohol", False)
        hr.custom_rules = combined_rules
        hr.cancellation_policy = rules_data.get("cancellation_policy", "moderate")
        hr.check_in_from = _parse_time(rules_data["check_in_time"])
        hr.check_out_by = _parse_time(rules_data["check_out_time"])
        hr.save()

        ListingBlockedDate.objects.filter(listing=listing).delete()
        for bd in d.get("blocked_dates", []):
            ListingBlockedDate.objects.create(
                listing=listing,
                start_date=bd["start_date"],
                end_date=bd["end_date"],
                reason=bd.get("reason", ""),
            )

    return {
        "listing_id": str(listing.id),
        "property_id": str(listing.property_id),
        "status": listing.status,
        "message": "Listing updated successfully.",
    }


def delete_listing(user: User, listing_id: str) -> bool:
    """
    Remove a listing. If it has no bookings, hard-delete it and its property.
    If bookings exist, the booking FK is RESTRICT (history must survive), so we
    soft-delete instead: mark the listing (and property) delisted so it drops
    out of the host's list and guest search while the bookings stay intact.
    """
    logger.info("delete_listing user_id=%s listing_id=%s", getattr(user, "id", None), listing_id)
    try:
        listing = Listing.objects.select_related("property", "room").get(id=listing_id, host_user=user)
    except Listing.DoesNotExist:
        return False

    if listing.bookings.exists():
        with transaction.atomic():
            listing.status = Listing.Status.DELISTED
            listing.save(update_fields=["status"])
            prop = listing.property
            if prop:
                prop.status = Property.Status.DELISTED
                prop.save(update_fields=["status"])
        logger.info("delete_listing: soft-deleted (has bookings) listing_id=%s", listing_id)
        return True

    with transaction.atomic():
        prop = listing.property
        listing.delete()
        prop.delete()

    return True


def update_blocked_dates(user: User, listing_id: str, blocked_dates: list[dict]) -> dict | None:
    """Replace all blocked dates for a listing."""
    logger.info("update_blocked_dates user_id=%s listing_id=%s", getattr(user, "id", None), listing_id)
    try:
        listing = Listing.objects.get(id=listing_id, host_user=user)
    except Listing.DoesNotExist:
        return None

    with transaction.atomic():
        ListingBlockedDate.objects.filter(listing=listing).delete()
        for bd in blocked_dates:
            ListingBlockedDate.objects.create(
                listing=listing,
                start_date=bd["start_date"],
                end_date=bd["end_date"],
                reason=bd.get("reason", ""),
            )

    return {
        "listing_id": str(listing.id),
        "blocked_dates": [
            {"start_date": bd.start_date.isoformat(), "end_date": bd.end_date.isoformat()}
            for bd in ListingBlockedDate.objects.filter(listing=listing)
        ],
    }


def toggle_snooze(user: User, listing_id: str) -> dict | None:
    """Toggle a listing between live and snoozed status."""
    logger.info("toggle_snooze user_id=%s listing_id=%s", getattr(user, "id", None), listing_id)
    try:
        listing = Listing.objects.get(id=listing_id, host_user=user)
    except Listing.DoesNotExist:
        return None

    if listing.status == Listing.Status.SNOOZED:
        listing.status = Listing.Status.LIVE
        listing.snoozed_until = None
    else:
        listing.status = Listing.Status.SNOOZED
        listing.snoozed_until = None
    listing.save(update_fields=["status", "snoozed_until"])

    return {"listing_id": str(listing.id), "status": listing.status}


def get_host_listings(user: User) -> list[dict]:
    """Returns all listings owned by a host."""
    from apps.bookings.models import Booking

    # The stored `total_bookings` column is never incremented, so compute the
    # real count live: bookings the host has committed to (accepted/active/
    # completed). Annotated under a separate name so it doesn't shadow the field.
    listings = (
        Listing.objects.filter(host_user=user)
        .exclude(status=Listing.Status.DELISTED)
        .select_related("property", "room")
        .annotate(
            _live_bookings=Count(
                "bookings",
                filter=Q(bookings__status__in=Booking.BLOCKING_STATUSES),
                distinct=True,
            )
        )
        .order_by("-created_at")
    )

    results = [_listing_to_dict(listing) for listing in listings]
    _attach_cover_photos(listings, results)

    profile = getattr(user, "profile", None)
    host_verified = bool(profile and profile.id_verification_status == "approved")
    for listing, r in zip(listings, results):
        r["visible_to_guests"] = host_verified and listing.status == Listing.Status.LIVE

    return results


def create_listing(user: User, data: dict) -> dict:
    """Create a full listing atomically from wizard form data."""
    logger.info("create_listing user_id=%s", getattr(user, "id", None))
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
            latitude=prop_data.get("latitude"),
            longitude=prop_data.get("longitude"),
            google_place_id=prop_data.get("google_place_id", ""),
            formatted_address=prop_data.get("formatted_address", ""),
            state=prop_data.get("state", ""),
            pincode=prop_data.get("pincode"),
            title=d["title"],
            description=d.get("description", ""),
            status=Property.Status.LIVE,
        )

        if not prop.latitude:
            geo = geocode_address(f"{prop.address_line1}, {prop.city_name}")
            if geo:
                prop.latitude = geo["latitude"]
                prop.longitude = geo["longitude"]
                prop.formatted_address = geo["formatted_address"]
                prop.google_place_id = geo.get("google_place_id", "")
                prop.save(update_fields=["latitude", "longitude", "formatted_address", "google_place_id"])

        for fm in d.get("flatmates", []):
            PropertyFlatmate.objects.create(
                property=prop,
                name=fm["name"],
                age=fm.get("age"),
                gender=fm.get("gender", "") or None,
                occupation=fm.get("occupation", ""),
                hobbies=fm.get("hobbies", ""),
                hometown=fm.get("hometown", ""),
            )

        room_data = d["room"]
        room = Room.objects.create(
            property=prop,
            room_type=room_data["room_type"],
            bed_type=room_data["bed_type"],
            bathroom_type=room_data["bathroom_type"],

            room_features=room_data.get("room_features", []),
        )

        meal_desc = _build_meal_description(d)
        listing = Listing.objects.create(
            host_user=user,
            property=prop,
            room=room,
            title=d["title"],
            description=d.get("description", ""),
            food_kitchen_access=d.get("food_kitchen_access", False),
            food_meals_available=d.get("food_meals_available", False),
            food_meal_cost=d.get("food_meal_cost"),
            food_meal_description=meal_desc or None,
            status=_listing_status_for_user(user),
        )
        _apply_pricing_fields(listing, d)
        listing.save()
        if listing.status == Listing.Status.LIVE:
            listing.published_at = datetime.now()
            listing.save(update_fields=["published_at"])

        amenity_names = d.get("amenities", [])
        if amenity_names:
            amenity_defs = AmenityDefinition.objects.filter(display_name__in=_resolve_amenity_names(amenity_names))
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

        for bd in d.get("blocked_dates", []):
            ListingBlockedDate.objects.create(
                listing=listing,
                start_date=bd["start_date"],
                end_date=bd["end_date"],
                reason=bd.get("reason", ""),
            )

    try:
        from third_party.admin_alerts import notify_admin
        state = "LIVE" if listing.status == Listing.Status.LIVE else "PENDING review"
        host_profile = getattr(user, "profile", None)
        host_name = f"{getattr(host_profile, 'first_name', '')} {getattr(host_profile, 'last_name', '')}".strip() or "Unknown host"
        host_phone = f"{user.phone_country_code}{user.phone_number}" if user.phone_number else ""
        notify_admin(
            f"📋 New listing ({state})\n“{listing.title}” — {prop.city_name or ''}\n"
            f"Host: {host_name} ({host_phone})"
        )
    except Exception:
        logger.exception("admin listing alert failed")

    return {
        "listing_id": str(listing.id),
        "property_id": str(listing.property_id),
        "status": listing.status,
        "message": (
            "Listing published successfully."
            if listing.status == Listing.Status.LIVE
            else "Listing created. It will go live once your Aadhaar is verified."
        ),
    }


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _build_meal_description(d: dict) -> str:
    parts = []
    meal_types = d.get("food_meal_types", [])
    meal_desc = (d.get("food_meal_description") or "").strip()
    if meal_types:
        parts.append("Meals served: " + ", ".join(meal_types))
    if meal_desc:
        parts.append(meal_desc)
    return "\n".join(parts)


def _apply_pricing_fields(listing: Listing, d: dict) -> None:
    """
    Set pricing fields on a listing from the request dict, branching on
    rental_type. Monthly listings leave host_price_per_night null and vice
    versa. Shared by create_listing and update_listing.
    """
    rental_type = d.get("rental_type", Listing.RentalType.MONTHLY)
    listing.rental_type = rental_type
    listing.security_deposit = d.get("security_deposit") or 0

    if rental_type == Listing.RentalType.MONTHLY:
        listing.monthly_rent = d.get("monthly_rent")
        listing.maintenance_monthly = d.get("maintenance_monthly") or 0
        listing.setup_cost_onetime = d.get("setup_cost_onetime") or 0
        listing.setup_cost_refundable = bool(d.get("setup_cost_refundable", False))
        listing.cook_available = bool(d.get("cook_available", False))
        listing.cook_cost_monthly = d.get("cook_cost_monthly") if listing.cook_available else None
        listing.maid_available = bool(d.get("maid_available", False))
        listing.maid_cost_monthly = d.get("maid_cost_monthly") if listing.maid_available else None
        listing.utilities_included = bool(d.get("utilities_included", False))
        listing.utilities_est_monthly = d.get("utilities_est_monthly")
        listing.min_months = d.get("min_months")
        listing.available_from = d.get("available_from")
        # Nightly rate not used for monthly; null it so stale values don't linger.
        listing.host_price_per_night = None
        listing.min_nights = 1
    else:
        listing.host_price_per_night = d.get("host_price_per_night")
        listing.min_nights = d.get("min_nights", 1)
        # Clear any monthly leftovers on a nightly listing.
        listing.monthly_rent = None


def _pricing_dict(listing: Listing) -> dict:
    """
    Null-safe pricing block for API responses, covering both rental types.
    Includes a precomputed monthly breakdown so the client doesn't re-derive it.
    """
    def f(v):
        return float(v) if v is not None else None

    is_monthly = listing.rental_type == Listing.RentalType.MONTHLY
    monthly_rent = f(listing.monthly_rent)
    maintenance = f(listing.maintenance_monthly) or 0.0
    deposit = f(listing.security_deposit) or 0.0
    setup = f(listing.setup_cost_onetime) or 0.0
    # Cook, maid and utilities are mandatory recurring costs when the host lists
    # them — they come with the flat, the guest can't opt out. They roll into
    # the monthly total. Only deposit + setup are separate one-time costs.
    cook = (f(listing.cook_cost_monthly) or 0.0) if listing.cook_available else 0.0
    maid = (f(listing.maid_cost_monthly) or 0.0) if listing.maid_available else 0.0
    utils = 0.0 if listing.utilities_included else (f(listing.utilities_est_monthly) or 0.0)

    breakdown = None
    recurring = None
    if is_monthly and monthly_rent is not None:
        recurring = monthly_rent + maintenance + cook + maid + utils
        breakdown = {
            "monthly_rent": monthly_rent,
            "maintenance_monthly": maintenance,
            "security_deposit": deposit,
            "setup_cost_onetime": setup,
            "setup_cost_refundable": listing.setup_cost_refundable,
            "cook_available": listing.cook_available,
            "cook_cost_monthly": f(listing.cook_cost_monthly),
            "maid_available": listing.maid_available,
            "maid_cost_monthly": f(listing.maid_cost_monthly),
            "utilities_included": listing.utilities_included,
            "utilities_est_monthly": f(listing.utilities_est_monthly),
            # recurring_monthly = every mandatory monthly cost. move_in = first
            # month (full recurring) + deposit + setup.
            "recurring_monthly": recurring,
            "move_in_cost": recurring + deposit + setup,
        }

    return {
        "rental_type": listing.rental_type,
        "host_price_per_night": f(listing.host_price_per_night),
        "guest_price_per_night": f(listing.host_price_per_night),
        "monthly_rent": monthly_rent,
        # Full mandatory monthly (rent + maintenance + cook + maid + utilities).
        # This is what cards/headlines should show, not the bare rent.
        "recurring_monthly": recurring,
        "min_nights": listing.min_nights,
        "min_months": listing.min_months,
        "available_from": listing.available_from.isoformat() if listing.available_from else None,
        "security_deposit": deposit,
        "monthly_breakdown": breakdown,
    }


def _listing_status_for_user(user: User) -> str:
    try:
        if user.profile.id_verification_status == UserProfile.IDVerificationStatus.APPROVED:
            return Listing.Status.LIVE
    except UserProfile.DoesNotExist:
        pass
    return Listing.Status.PENDING


def _parse_time(time_str: str) -> str:
    """Convert '2:00 PM' → '14:00' for Django TimeField."""
    try:
        dt = datetime.strptime(time_str.strip(), "%I:%M %p")
        return dt.strftime("%H:%M")
    except (ValueError, AttributeError):
        return "12:00"


def _format_time(t) -> str:
    """Convert TimeField value '14:00' → '2:00 PM' for the wizard."""
    try:
        dt = datetime.strptime(str(t)[:5], "%H:%M")
        return dt.strftime("%I:%M %p").lstrip("0")
    except Exception:
        logger.exception("_format_time failed")
        return ""


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
    is_monthly = listing.rental_type == Listing.RentalType.MONTHLY
    nightly = float(listing.host_price_per_night) if listing.host_price_per_night is not None else None
    monthly = float(listing.monthly_rent) if listing.monthly_rent is not None else None
    # Card shows the FULL mandatory monthly (rent + maintenance + cook + maid +
    # utilities), not the bare rent — that's the real recurring cost.
    recurring = _pricing_dict(listing).get("recurring_monthly") if is_monthly else None
    display_price = (recurring if recurring is not None else monthly) if is_monthly else nightly
    return {
        "listing_id": str(listing.id),
        "title": listing.title,
        "area_name": _get_area_name(listing),
        "rental_type": listing.rental_type,
        "display_price": display_price,
        "price_unit": "month" if is_monthly else "night",
        # Kept for backward-compat with nightly clients; null on monthly.
        "host_price_per_night": nightly,
        "guest_price_per_night": nightly,
        "monthly_rent": monthly,
        "recurring_monthly": recurring,
        "status": listing.status,
        "average_rating": float(listing.average_rating) if listing.average_rating else None,
        "review_count": listing.review_count,
        # Prefer the live-annotated count (get_host_listings) over the stale
        # stored column, which is never incremented.
        "total_bookings": getattr(listing, "_live_bookings", None)
            if getattr(listing, "_live_bookings", None) is not None
            else listing.total_bookings,
        "cover_photo_url": None,
    }


def _get_area_name(listing: Listing) -> str:
    try:
        prop = listing.property
        if prop.formatted_address:
            return prop.formatted_address.split(",")[0]
        return prop.apartment_name or prop.city_name
    except Exception:
        logger.exception("_get_area_name failed")
        return ""


def _attach_cover_photos(listings, results: list[dict]):

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
        raw_url = photo_map.get(prop_id)
        r["cover_photo_url"] = get_photo_url(raw_url) if raw_url else None


# ─── Guest-facing ─────────────────────────────────────────────────────────────

POPULAR_AMENITIES = {"AC", "WiFi", "Geyser / Hot water", "Full kitchen access", "Parking (2-wheeler)", "Parking (4-wheeler)", "Washing machine"}

def search_guest_listings(
    query: str | None = None,
    area: str | None = None,
    check_in: str | None = None,
    check_out: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float = 5.0,
    min_price: float | None = None,
    max_price: float | None = None,
    min_rating: float | None = None,
    sort: str | None = None,
) -> list[dict]:

    qs = (
        Listing.objects
        .filter(status=Listing.Status.LIVE)
        .filter(host_user__profile__id_verification_status="approved")
        .select_related("property", "room")
        .prefetch_related("listing_amenities__amenity")
    )

    # ── Price & rating filters ──────────────────────────────────────────
    if min_price is not None:
        qs = qs.filter(host_price_per_night__gte=min_price)
    if max_price is not None:
        qs = qs.filter(host_price_per_night__lte=max_price)
    if min_rating is not None:
        qs = qs.filter(average_rating__gte=min_rating)

    # ── Sort ────────────────────────────────────────────────────────────
    has_geo = lat is not None and lng is not None
    sort = (sort or ("distance" if has_geo else "recommended")).lower()
    DB_ORDER = {
        "price_low": ("host_price_per_night", "-created_at"),
        "price_high": ("-host_price_per_night", "-created_at"),
        "rating": ("-average_rating", "-created_at"),
        "recommended": ("-average_rating", "-created_at"),
    }
    # "distance" is applied in Python after the query (needs lat/lng); until
    # then order by the recommended default so the [:50] slice is sensible.
    qs = qs.order_by(*DB_ORDER.get(sort, DB_ORDER["recommended"]))

    CITY_ALIASES = {
        "bangalore": "bengaluru",
        "bengaluru": "bangalore",
        "bombay": "mumbai",
        "mumbai": "bombay",
        "calcutta": "kolkata",
        "kolkata": "calcutta",
        "madras": "chennai",
        "chennai": "madras",
    }

    def _text_filter(term: str) -> Q:
        terms = [term]
        alias = CITY_ALIASES.get(term.lower())
        if alias:
            terms.append(alias)
        combined = Q()
        for t in terms:
            combined |= (
                Q(property__address_line1__icontains=t)
                | Q(property__apartment_name__icontains=t)
                | Q(property__city_name__icontains=t)
                | Q(property__formatted_address__icontains=t)
                | Q(title__icontains=t)
            )
        return combined

    if lat is not None and lng is not None:
        # Early-stage: no distance cutoff. If the guest also typed a place,
        # narrow to text matches; otherwise show every live listing. Results
        # are ordered closest-first by the distance sort below, so a guest in
        # a city with no inventory still sees the nearest available rooms
        # (just far away) instead of an empty screen.
        search_term = query or area
        if search_term:
            qs = qs.filter(_text_filter(search_term))
        # else: no geo/text filter — all live listings, sorted by distance.
    else:
        search_term = query or area
        if search_term:
            qs = qs.filter(_text_filter(search_term))

    if check_in and check_out:
        try:
            ci = date_type.fromisoformat(check_in)
            co = date_type.fromisoformat(check_out)
            stay_nights = (co - ci).days
            qs = qs.filter(min_nights__lte=stay_nights)

            blocked_ids = ListingBlockedDate.objects.filter(
                start_date__lt=co, end_date__gt=ci
            ).values_list("listing_id", flat=True)
            qs = qs.exclude(id__in=blocked_ids)

            from apps.bookings.models import Booking
            from django.utils import timezone
            now = timezone.now()
            booked_ids = (
                Booking.objects.filter(
                    check_in_date__lt=co,
                    check_out_date__gt=ci,
                ).filter(
                    Q(status__in=Booking.BLOCKING_STATUSES)
                    | Q(status=Booking.Status.PENDING, expires_at__gt=now)
                    | Q(status=Booking.Status.PENDING, expires_at__isnull=True)
                ).values_list("listing_id", flat=True)
            )
            qs = qs.exclude(id__in=booked_ids)
        except (ValueError, TypeError):
            pass

    qs = qs[:50]
    results = [_listing_to_guest_card(l) for l in qs]
    _attach_cover_photos(qs, results)

    if has_geo:
        for r in results:
            if r["latitude"] and r["longitude"]:
                r["distance_km"] = _haversine(lat, lng, r["latitude"], r["longitude"])
            else:
                r["distance_km"] = None
        # Only reorder by distance when that's the chosen sort; otherwise keep
        # the DB ordering (price / rating / recommended) and just show distance.
        if sort == "distance":
            results.sort(key=lambda r: r["distance_km"] if r["distance_km"] is not None else float("inf"))

    return results


def _mask_phone(phone: str | None) -> str | None:
    """Mask all but the last 2 digits, e.g. '+91 ●●●●●●●●42'."""
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) < 2:
        return "●●●●●●"
    return "●●●●●●●●" + digits[-2:]


def get_guest_listing_detail(listing_id: str, viewer=None) -> dict | None:

    try:
        listing = (
            Listing.objects
            .filter(status=Listing.Status.LIVE)
            .filter(host_user__profile__id_verification_status="approved")
            .select_related("property", "room", "house_rules", "host_user")
            .prefetch_related("listing_amenities__amenity")
            .get(id=listing_id)
        )
    except Listing.DoesNotExist:
        return None

    prop = listing.property
    room = listing.room
    rules = getattr(listing, "house_rules", None)

    # Photos
    photos = []
    for p in PropertyPhoto.objects.filter(property=prop).order_by("sort_order", "uploaded_at"):
        photos.append({
            "url": get_photo_url(p.url),
            "thumbnail_url": get_photo_url(p.thumbnail_url) if p.thumbnail_url else None,
            "area": p.area,
            "is_cover": p.is_cover,
        })

    # Amenities
    amenities = [
        {"display_name": la.amenity.display_name, "category": la.amenity.category.display_name}
        for la in listing.listing_amenities.select_related("amenity__category").all()
    ]

    # Flatmates
    flatmates_qs = PropertyFlatmate.objects.filter(property=prop, is_visible=True)
    host_fm = None
    flatmates = []
    for fm in flatmates_qs:
        if fm.name == "__host__":
            host_fm = fm
        else:
            flatmates.append({
                "name": fm.name,
                "age": fm.age,
                "gender": fm.gender or "",
                "occupation": fm.occupation or "",
                "hobbies": fm.hobbies or "",
                "hometown": fm.hometown or "",
            })

    # Host profile
    host_name = ""
    host_profile_data = {}
    profile = None
    try:
        profile = listing.host_user.profile
        host_name = f"{profile.first_name} {profile.last_name[0]}." if profile.last_name else profile.first_name
        host_profile_data = {
            "full_name": f"{profile.first_name} {profile.last_name}".strip(),
            "photo_url": get_photo_url(profile.profile_photo_url) if profile.profile_photo_url else None,
            "gender": profile.gender or "",
            "member_since": listing.host_user.created_at.strftime("%b %Y"),
        }
        # Host age: prefer the value entered in the flatmates section,
        # otherwise derive it from the host's date of birth.
        host_profile_data["age"] = (
            (host_fm.age if host_fm else None)
            or _age_from_dob(getattr(profile, "date_of_birth", None))
        )
        if host_fm:
            host_profile_data["occupation"] = host_fm.occupation or ""
            host_profile_data["hobbies"] = host_fm.hobbies or ""
            host_profile_data["hometown"] = host_fm.hometown or ""
    except Exception:
        logger.exception("get_guest_listing_detail failed")
        pass

    # Food
    meal_desc = ""
    if listing.food_meal_description:
        lines = [l for l in listing.food_meal_description.split("\n") if not l.startswith("Meals served: ")]
        meal_desc = "\n".join(lines).strip()

    meal_types_str = None
    if listing.food_meal_description:
        for line in listing.food_meal_description.split("\n"):
            if line.startswith("Meals served: "):
                meal_types_str = line.replace("Meals served: ", "")
                break

    # ── Host contact (gated behind the ₹29 unlock) ──────────────────────
    host_full_phone = None
    host_num = getattr(listing.host_user, "phone_number", "") or ""
    if host_num:
        host_cc = getattr(listing.host_user, "phone_country_code", "") or ""
        host_full_phone = f"{host_cc}{host_num}".strip()

    is_own_listing = bool(viewer and viewer.id == listing.host_user_id)
    contact_unlocked = is_own_listing
    if viewer and not is_own_listing:
        from apps.payments.models import ContactUnlock
        contact_unlocked = ContactUnlock.objects.filter(
            guest_user=viewer, listing=listing,
            status=ContactUnlock.Status.UNLOCKED,
        ).exists()

    return {
        "listing_id": str(listing.id),
        "title": listing.title,
        "description": listing.description or "",
        "booking_mode": listing.booking_mode,
        **_pricing_dict(listing),
        "max_nights": listing.max_nights,
        "property": {
            "apartment_type": prop.apartment_type,
            "apartment_name": prop.apartment_name,
            "city_name": prop.city_name,
            "gender_preference": prop.gender_preference,
            "latitude": float(prop.latitude) if prop.latitude else None,
            "longitude": float(prop.longitude) if prop.longitude else None,
        },
        "room": {
            "room_type": room.room_type,
            "bed_type": room.bed_type,
            "bathroom_type": room.bathroom_type,
            "room_features": room.room_features if isinstance(room.room_features, list) else [],
        },
        "photos": photos,
        "amenities": amenities,
        "flatmates": flatmates,
        "host_info": {
            "age": (host_fm.age if host_fm else None) or _age_from_dob(getattr(profile, "date_of_birth", None)),
            "occupation": host_fm.occupation if host_fm else "",
            "hobbies": host_fm.hobbies if host_fm else "",
            "gender": host_fm.gender if host_fm else "",
            "hometown": host_fm.hometown if host_fm else "",
        },
        "host_verifications": {
            "aadhaar": bool(profile and profile.id_verification_status == "approved"),
            "email": bool(listing.host_user.email_verified_at),
            "phone": bool(listing.host_user.phone_verified_at),
        } if profile else {"aadhaar": False, "email": False, "phone": False},
        "food": {
            "kitchen_access": listing.food_kitchen_access,
            "meals_available": listing.food_meals_available,
            "meal_cost": float(listing.food_meal_cost) if listing.food_meal_cost else None,
            "meal_description": meal_desc,
            "meal_types": meal_types_str,
        },
        "house_rules": _parse_all_house_rules(rules),
        "check_in_from": _format_time(rules.check_in_from) if rules else "",
        "check_out_by": _format_time(rules.check_out_by) if rules else "",
        "average_rating": float(listing.average_rating) if listing.average_rating else None,
        "review_count": listing.review_count,
        "total_bookings": listing.total_bookings,
        "host_name": host_name,
        "host_profile": host_profile_data,
        "contact_unlocked": contact_unlocked,
        "host_phone": host_full_phone if contact_unlocked else None,
        "host_phone_masked": _mask_phone(host_full_phone),
        "unlock_fee": float(settings.CONTACT_UNLOCK_FEE),
        "area_name": _get_area_name(listing),
        "blocked_dates": [
            {"start_date": bd.start_date.isoformat(), "end_date": bd.end_date.isoformat()}
            for bd in ListingBlockedDate.objects.filter(listing=listing)
        ],
    }

def _parse_all_house_rules(rules) -> dict:
    """Parse all 8 house rules including extras stored in custom_rules."""
    if not rules:
        return {
            "no_smoking": True, "no_loud_music": False, "no_pets": True,
            "no_alcohol": False, "no_parties": False, "shoes_off": False,
            "kitchen_clean": False, "lock_door": False, "custom_rules": None,
        }

    no_parties = shoes_off = kitchen_clean = lock_door = False
    remaining = []
    if rules.custom_rules:
        for line in rules.custom_rules.split("\n"):
            stripped = line.strip()
            if stripped == "No parties or events":
                no_parties = True
            elif stripped == "Please remove shoes at the entrance":
                shoes_off = True
            elif stripped == "Please keep the kitchen clean after use":
                kitchen_clean = True
            elif stripped == "Please lock the main door when leaving":
                lock_door = True
            elif stripped:
                remaining.append(stripped)

    return {
        "no_smoking": rules.no_smoking,
        "no_loud_music": True,
        "no_pets": rules.no_pets,
        "no_alcohol": rules.no_alcohol,
        "no_parties": no_parties,
        "shoes_off": shoes_off,
        "kitchen_clean": kitchen_clean,
        "lock_door": lock_door,
        "custom_rules": "\n".join(remaining) if remaining else None,
    }

def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 1)


def _listing_to_guest_card(listing: Listing) -> dict:
    amenity_names = [
        la.amenity.display_name
        for la in listing.listing_amenities.all()
        if la.amenity.display_name in POPULAR_AMENITIES
    ][:4]

    desc = (listing.description or "")[:120]
    if len(listing.description or "") > 120:
        desc += "..."

    return {
        "listing_id": str(listing.id),
        "title": listing.title,
        "description": desc,
        "area_name": _get_area_name(listing),
        **_pricing_dict(listing),
        "cover_photo_url": None,
        "average_rating": float(listing.average_rating) if listing.average_rating else None,
        "review_count": listing.review_count,
        "room_type": listing.room.room_type,
        "apartment_type": listing.property.apartment_type,
        "amenity_highlights": amenity_names,
        "booking_mode": listing.booking_mode,
        "gender_preference": listing.property.gender_preference,
        "min_nights": listing.min_nights,
        "meals_available": listing.food_meals_available,
        "meal_cost_per_day": float(listing.food_meal_cost) if listing.food_meal_cost else None,
        "latitude": float(listing.property.latitude) if listing.property.latitude else None,
        "longitude": float(listing.property.longitude) if listing.property.longitude else None,
    }
