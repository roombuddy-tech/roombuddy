"""
Seed test data for end-to-end booking + payment testing.

Usage:
    python3 manage.py seed_test_data

Creates:
- 1 host user (phone: 9999900001)
- 1 guest user (phone: 9999900002)
- 1 property + 1 room + 1 listing (LIVE status)
- House rules with cancellation policy

Idempotent: safe to run multiple times. Uses get_or_create.
"""
import uuid
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.users.models import User
from apps.properties.models import Property
from apps.rooms.models import Room
from apps.listings.models import Listing, ListingHouseRules


class Command(BaseCommand):
    help = "Seed test data for booking and payment testing"

    def handle(self, *args, **opts):
        self.stdout.write(self.style.NOTICE("🌱 Seeding test data...\n"))

        # ─── 1. Create host and guest users ────────────────────────
        host, created = User.objects.get_or_create(
            phone_country_code="+91",
            phone_number="9999900001",
            defaults={
                "email": "host@roombuddy.test",
                "phone_verified_at": timezone.now(),
                "email_verified_at": timezone.now(),
                "is_profile_complete": True,
            },
        )
        self.stdout.write(f"  Host user: {host.id} ({'created' if created else 'exists'})")

        guest, created = User.objects.get_or_create(
            phone_country_code="+91",
            phone_number="9999900002",
            defaults={
                "email": "guest@roombuddy.test",
                "phone_verified_at": timezone.now(),
                "email_verified_at": timezone.now(),
                "is_profile_complete": True,
            },
        )
        self.stdout.write(f"  Guest user: {guest.id} ({'created' if created else 'exists'})")

        # ─── 2. Create a property ──────────────────────────────────
        property_obj, created = Property.objects.get_or_create(
            host_user=host,
            apartment_name="Test Sunshine Apartments",
            defaults={
                "apartment_type": Property.ApartmentType.BHK_2,
                "floor_number": 3,
                "total_floors": 5,
                "latitude": Decimal("12.971599"),
                "longitude": Decimal("77.594566"),
                "city_id": uuid.uuid4(),  # placeholder
                "city_name": "Bengaluru",
                "pincode": "560001",
                "title": "Cozy 2BHK in Indiranagar",
                "description": "A test property for booking flow testing.",
                "formatted_address": "100 Test Street, Indiranagar, Bengaluru, 560001",
                "address_line1": "100 Test Street",
                "ownership_type": Property.OwnershipType.OWNER_OCCUPIED,
                "status": Property.Status.LIVE,
                "published_at": timezone.now(),
            },
        )
        self.stdout.write(f"  Property: {property_obj.id} ({'created' if created else 'exists'})")

        # ─── 3. Create a room ──────────────────────────────────────
        room, created = Room.objects.get_or_create(
            property=property_obj,
            room_label="Master Bedroom",
            defaults={
                "room_type": Room.RoomType.PRIVATE,
                "bed_type": Room.BedType.QUEEN,
                "bed_count": 1,
                "max_guests": 2,
                "bathroom_type": Room.BathroomType.ATTACHED,
                "room_size_sqft": 150,
            },
        )
        self.stdout.write(f"  Room: {room.id} ({'created' if created else 'exists'})")

        # ─── 4. Create a LIVE listing ──────────────────────────────
        listing, created = Listing.objects.get_or_create(
            room=room,
            property=property_obj,
            host_user=host,
            defaults={
                "title": "Master Bedroom in Indiranagar 2BHK",
                "description": "Spacious bedroom for testing booking flow.",
                "host_price_per_night": Decimal("1500.00"),
                "gst_pct": Decimal("12.00"),
                "platform_fee_pct": Decimal("10.00"),
                "currency": "INR",
                "min_nights": 1,
                "max_nights": 30,
                "booking_mode": Listing.BookingMode.INSTANT,
                "security_deposit": Decimal("0"),
                "status": Listing.Status.LIVE,
                "published_at": timezone.now(),
            },
        )
        self.stdout.write(f"  Listing: {listing.id} ({'created' if created else 'exists'})")

        # ─── 5. House rules (with cancellation policy) ─────────────
        rules, created = ListingHouseRules.objects.get_or_create(
            listing=listing,
            defaults={
                "cancellation_policy": ListingHouseRules.CancellationPolicy.MODERATE,
            },
        )
        self.stdout.write(f"  House rules: {'created' if created else 'exists'} (policy: {rules.cancellation_policy})")

        # ─── 6. Print summary ──────────────────────────────────────
        self.stdout.write(self.style.SUCCESS("\n✅ Seed complete!\n"))
        self.stdout.write(self.style.WARNING("📋 Use these IDs for testing:\n"))
        self.stdout.write(f"  HOST_USER_ID  = {host.id}")
        self.stdout.write(f"  HOST_PHONE    = +91 9999900001")
        self.stdout.write(f"  GUEST_USER_ID = {guest.id}")
        self.stdout.write(f"  GUEST_PHONE   = +91 9999900002")
        self.stdout.write(f"  LISTING_ID    = {listing.id}")
        self.stdout.write(f"  PRICE/NIGHT   = ₹{listing.host_price_per_night}")
        self.stdout.write("")