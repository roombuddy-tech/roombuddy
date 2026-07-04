from datetime import datetime

from django.db import transaction
from django.utils import timezone
from django.db.models import Q

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
from third_party.storage import get_photo_url
from third_party.maps import geocode_address

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
        .values("id", "name", "age", "gender", "occupation", "hobbies")
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
            }
            for f in real_flatmates
        ],
        "amenities": amenity_names,
        "title": listing.title,
        "description": listing.description or "",
        "host_price_per_night": float(listing.host_price_per_night),
        "min_nights": listing.min_nights,
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
            "age": host_fm["age"] if host_fm else None,
            "occupation": host_fm["occupation"] if host_fm else "",
            "hobbies": host_fm["hobbies"] if host_fm else "",
            "gender": host_fm["gender"] if host_fm else "",
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

        PropertyFlatmate.objects.filter(property=prop).delete()
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
        listing.host_price_per_night = d["host_price_per_night"]
        listing.min_nights = d.get("min_nights", 1)
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
            amenity_defs = AmenityDefinition.objects.filter(display_name__in=amenity_names)
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
    """Delete a listing and its associated property, room, and related data."""
    logger.info("delete_listing user_id=%s listing_id=%s", getattr(user, "id", None), listing_id)
    try:
        listing = Listing.objects.select_related("property", "room").get(id=listing_id, host_user=user)
    except Listing.DoesNotExist:
        return False

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

    listings = Listing.objects.filter(
        host_user=user
    ).select_related("property", "room").order_by("-created_at")

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
            host_price_per_night=d["host_price_per_night"],
            min_nights=d.get("min_nights", 1),
            food_kitchen_access=d.get("food_kitchen_access", False),
            food_meals_available=d.get("food_meals_available", False),
            food_meal_cost=d.get("food_meal_cost"),
            food_meal_description=meal_desc or None,
            status=_listing_status_for_user(user),
        )
        if listing.status == Listing.Status.LIVE:
            listing.published_at = datetime.now()
            listing.save(update_fields=["published_at"])

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
) -> list[dict]:

    qs = (
        Listing.objects
        .filter(status=Listing.Status.LIVE)
        .filter(host_user__profile__id_verification_status="approved")
        .select_related("property", "room")
        .prefetch_related("listing_amenities__amenity")
        .order_by("-average_rating", "-created_at")
    )

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
        effective_radius = max(radius_km, 15.0)
        delta_lat = effective_radius / 111.0
        delta_lng = effective_radius / (111.0 * math.cos(math.radians(lat)))
        geo_filter = Q(
            property__latitude__isnull=False,
            property__longitude__isnull=False,
            property__latitude__gte=lat - delta_lat,
            property__latitude__lte=lat + delta_lat,
            property__longitude__gte=lng - delta_lng,
            property__longitude__lte=lng + delta_lng,
        )
        search_term = query or area
        if search_term:
            qs = qs.filter(geo_filter | _text_filter(search_term))
        else:
            qs = qs.filter(geo_filter)
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
        except (ValueError, TypeError):
            pass

    qs = qs[:50]
    results = [_listing_to_guest_card(l) for l in qs]
    _attach_cover_photos(qs, results)
    return results


def get_guest_listing_detail(listing_id: str) -> dict | None:

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
    try:
        profile = listing.host_user.profile
        host_name = f"{profile.first_name} {profile.last_name[0]}." if profile.last_name else profile.first_name
        host_profile_data = {
            "full_name": f"{profile.first_name} {profile.last_name}".strip(),
            "photo_url": get_photo_url(profile.profile_photo_url) if profile.profile_photo_url else None,
            "gender": profile.gender or "",
            "member_since": listing.host_user.created_at.strftime("%b %Y"),
        }
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

    return {
        "listing_id": str(listing.id),
        "title": listing.title,
        "description": listing.description or "",
        "booking_mode": listing.booking_mode,
        "host_price_per_night": float(listing.host_price_per_night),
        "guest_price_per_night": float(listing.guest_price_per_night),
        "min_nights": listing.min_nights,
        "max_nights": listing.max_nights,
        "security_deposit": float(listing.security_deposit),
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
            "occupation": host_fm.occupation if host_fm else "",
            "hobbies": host_fm.hobbies if host_fm else "",
            "gender": host_fm.gender if host_fm else "",
        },
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
        "guest_price_per_night": float(listing.guest_price_per_night),
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
