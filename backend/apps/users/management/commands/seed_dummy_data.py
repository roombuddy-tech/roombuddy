"""
seed_dummy_data.py
==================
Creates a complete set of demo data so every screen in the RoomBuddy app
shows realistic, populated content.

What it creates
---------------
Users (all login with OTP 111111):
  Host  – Rahul Sharma     +91 9800000001
  Guest – Priya Mehta      +91 9800000002  (COMPLETED booking)
  Guest – Arjun Singh      +91 9800000003  (ACTIVE booking, currently staying)
  Guest – Sneha Patel      +91 9800000004  (UPCOMING/accepted booking)

Listing:
  2BHK private room in Koramangala, Bengaluru – ₹799/night

Bookings (all PAID):
  1. Priya   – COMPLETED  Jun 1-4    (past)
  2. Arjun   – ACTIVE     Jul 2-8    (ongoing, checked in)
  3. Sneha   – ACCEPTED   Jul 10-12  (upcoming)

Payments, earnings, payout, conversations with messages, reviews.

Usage
-----
  python manage.py seed_dummy_data           # create (skips if already exists)
  python manage.py seed_dummy_data --flush   # delete existing seed data first
  python manage.py seed_dummy_data --skip-photos  # skip photo downloads (faster)
"""

import uuid
import hashlib
import random
import string
from datetime import date, timedelta, time
from decimal import Decimal
from io import BytesIO

import requests
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.conf import settings

from apps.users.models import User, UserProfile, OTPCode, PayoutAccount
from apps.properties.models import Property, PropertyFlatmate, PropertyPhoto
from apps.rooms.models import Room
from apps.listings.models import Listing, ListingAmenity, ListingHouseRules
from apps.amenities.models import AmenityDefinition
from apps.bookings.models import Booking, BookingStatusHistory
from apps.payments.models import Payment, Payout
from apps.conversations.models import Conversation, Message
from apps.reviews.models import Review
from third_party.storage import upload_image

# ─── Seed identity ─────────────────────────────────────────────────────────────

SEED_MARKER = "SEED_DEMO"          # Stored in `apartment_name` to identify seeded property

USERS = [
    {
        "phone": "9800000001",
        "first_name": "Rahul",
        "last_name": "Sharma",
        "gender": "male",
        "city": "Bengaluru",
        "role": "host",
        "profile_photo_id": "photo-1507003211169-0a1dd7228f2d",
    },
    {
        "phone": "9800000002",
        "first_name": "Priya",
        "last_name": "Mehta",
        "gender": "female",
        "city": "Mumbai",
        "role": "guest",
        "profile_photo_id": "photo-1494790108377-be9c29b29330",
    },
    {
        "phone": "9800000003",
        "first_name": "Arjun",
        "last_name": "Singh",
        "gender": "male",
        "city": "Delhi",
        "role": "guest",
        "profile_photo_id": "photo-1500648767791-00dcc994a43e",
    },
    {
        "phone": "9800000004",
        "first_name": "Sneha",
        "last_name": "Patel",
        "gender": "female",
        "city": "Pune",
        "role": "guest",
        "profile_photo_id": "photo-1438761681033-6461ffad8d80",
    },
]

# Unsplash photo IDs (free, high quality)
PROPERTY_PHOTOS = [
    ("bedroom",    "photo-1631049307264-da0ec9d70304"),
    ("bedroom",    "photo-1586023492125-27b2c045efd7"),
    ("washroom",   "photo-1552321554-5fefe8c9ef14"),
    ("kitchen",    "photo-1556909114-f6e7ad7d3136"),
    ("living_room","photo-1555041469-a586c61ea9bc"),
]

# ─── Pricing constants ─────────────────────────────────────────────────────────

HOST_NIGHTLY   = Decimal("799.00")
GST_PCT        = Decimal("12.00")
GUEST_FEE_PCT  = Decimal("5.00")
HOST_FEE_PCT   = Decimal("5.00")

def calc_booking(nights: int):
    subtotal          = HOST_NIGHTLY * nights
    gst               = (subtotal * GST_PCT  / 100).quantize(Decimal("0.01"))
    guest_fee         = (subtotal * GUEST_FEE_PCT / 100).quantize(Decimal("0.01"))
    host_fee          = (subtotal * HOST_FEE_PCT  / 100).quantize(Decimal("0.01"))
    guest_nightly     = (HOST_NIGHTLY * (1 + (GST_PCT + GUEST_FEE_PCT) / 100)).quantize(Decimal("0.01"))
    total_guest_pays  = (subtotal + gst + guest_fee).quantize(Decimal("0.01"))
    total_host_rcv    = (subtotal - host_fee).quantize(Decimal("0.01"))
    platform_rev      = (gst + guest_fee + host_fee).quantize(Decimal("0.01"))
    return dict(
        host_nightly_price   = HOST_NIGHTLY,
        guest_nightly_price  = guest_nightly,
        subtotal             = subtotal,
        gst_amount           = gst,
        platform_fee         = guest_fee,
        host_platform_fee    = host_fee,
        total_guest_pays     = total_guest_pays,
        total_host_receives  = total_host_rcv,
        platform_revenue     = platform_rev,
    )

# ─── Helper: download + upload photo ───────────────────────────────────────────

def _download_unsplash(photo_id: str, width: int = 1200) -> BytesIO | None:
    url = f"https://images.unsplash.com/{photo_id}?w={width}&auto=format&fit=crop&q=80"
    try:
        r = requests.get(url, timeout=15, headers={"User-Agent": "RoomBuddy/1.0"})
        r.raise_for_status()
        buf = BytesIO(r.content)
        buf.name = f"{photo_id}.jpg"
        return buf
    except Exception as exc:
        return None


def _upload_photo(photo_id: str, folder: str, filename: str) -> dict | None:
    buf = _download_unsplash(photo_id)
    if buf is None:
        return None
    try:
        return upload_image(buf, folder=folder, filename=filename)
    except Exception:
        return None


# ─── OTP helper ────────────────────────────────────────────────────────────────

def _ensure_otp(user: User, phone: str):
    """Create (or refresh) a non-consumed OTP so the user can log in with 111111."""
    full_phone = f"+91{phone}"
    OTPCode.objects.filter(phone=full_phone, is_consumed=False).update(is_consumed=True)
    OTPCode.objects.create(
        user=user,
        phone=full_phone,
        otp_hash=OTPCode.hash_otp(settings.SEED_OTP),
        expires_at=timezone.now() + timedelta(hours=720),  # 30 days
    )


# ─── Management command ─────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = "Seed dummy host + guests + bookings + messages for UI evaluation"

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete all existing seed data before creating fresh data",
        )
        parser.add_argument(
            "--skip-photos",
            action="store_true",
            help="Skip downloading property & profile photos (faster but no images)",
        )

    def handle(self, *args, **options):
        flush       = options["flush"]
        skip_photos = options["skip_photos"]

        if flush:
            self._flush()

        self.stdout.write(self.style.MIGRATE_HEADING("\n🌱  RoomBuddy Seed Data\n"))

        with transaction.atomic():
            users = self._create_users(skip_photos)
            host  = next(u for u in users if u["info"]["role"] == "host")["user"]
            guests = [u for u in users if u["info"]["role"] == "guest"]

            listing = self._create_listing(host, skip_photos)
            self.stdout.write(f"   📍  Listing: {listing.title}")

            bookings = self._create_bookings(listing, host, guests)
            self._create_conversations(host, guests, bookings)
            self._create_reviews(bookings[0], guests[0]["user"], host, listing)
            payout = self._create_payout(host, [bookings[0]])

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("✅  Seed complete!\n"))
        self.stdout.write(self.style.HTTP_INFO("Login credentials (OTP: 111111)"))
        self.stdout.write("  Host  – Rahul Sharma  : +91 9800000001")
        self.stdout.write("  Guest – Priya Mehta   : +91 9800000002")
        self.stdout.write("  Guest – Arjun Singh   : +91 9800000003")
        self.stdout.write("  Guest – Sneha Patel   : +91 9800000004")
        self.stdout.write("")

    # ── Flush ──────────────────────────────────────────────────────────────────

    def _flush(self):
        self.stdout.write(self.style.WARNING("⚠️   Flushing existing seed data…"))
        phones = [u["phone"] for u in USERS]
        seed_users = User.objects.filter(phone_number__in=phones, phone_country_code="+91")
        # Delete in dependency order: bookings → listings → properties → users
        host_users = seed_users.filter(phone_number="9800000001")
        for host in host_users:
            Payout.objects.filter(host_user=host).delete()
            props = Property.objects.filter(host_user=host)
            for prop in props:
                listings = Listing.objects.filter(property=prop)
                for listing in listings:
                    bookings = Booking.objects.filter(listing=listing)
                    for booking in bookings:
                        Payment.objects.filter(booking=booking).delete()
                    bookings.delete()
                listings.delete()
            props.delete()
        seed_users.delete()
        self.stdout.write("   Done.\n")

    # ── Users ──────────────────────────────────────────────────────────────────

    def _create_users(self, skip_photos: bool) -> list[dict]:
        result = []
        for info in USERS:
            user, created = User.objects.get_or_create(
                phone_number=info["phone"],
                phone_country_code="+91",
                defaults={
                    "email": f"{info['first_name'].lower()}.{info['last_name'].lower()}@roombuddy.demo",
                    "phone_verified_at": timezone.now(),
                    "status": "active",
                    "is_profile_complete": True,
                },
            )
            if not created:
                user.phone_verified_at = timezone.now()
                user.status = "active"
                user.is_profile_complete = True
                user.save(update_fields=["phone_verified_at", "status", "is_profile_complete", "updated_at"])

            # Profile
            profile_photo_url = ""
            if not skip_photos:
                res = _upload_photo(
                    info["profile_photo_id"],
                    folder="profiles",
                    filename=f"seed_{info['phone']}.jpg",
                )
                if res:
                    profile_photo_url = res["url"]

            profile, _ = UserProfile.objects.update_or_create(
                user=user,
                defaults={
                    "first_name": info["first_name"],
                    "last_name": info["last_name"],
                    "gender": info["gender"],
                    "city": info["city"],
                    "date_of_birth": date(1995, random.randint(1, 12), random.randint(1, 28)),
                    "id_verification_status": "approved",
                    "profile_photo_url": profile_photo_url or "",
                },
            )

            _ensure_otp(user, info["phone"])

            action = "created" if created else "updated"
            self.stdout.write(f"   👤  {info['first_name']} {info['last_name']} ({info['role']}) — {action}")
            result.append({"user": user, "profile": profile, "info": info})

        # Payout account for host
        host_user = next(r["user"] for r in result if r["info"]["role"] == "host")
        PayoutAccount.objects.get_or_create(
            user=host_user,
            account_type="bank",
            defaults={
                "account_holder_name": "Rahul Sharma",
                "account_number": "1234567890",
                "ifsc_code": "HDFC0001234",
                "bank_name": "HDFC Bank",
                "is_primary": True,
            },
        )
        return result

    # ── Property + Listing ─────────────────────────────────────────────────────

    def _create_listing(self, host: User, skip_photos: bool) -> Listing:
        # Re-use existing seeded property if present
        existing_prop = Property.objects.filter(host_user=host, apartment_name=SEED_MARKER).first()
        if existing_prop:
            listing = Listing.objects.filter(property=existing_prop).first()
            if listing:
                self.stdout.write("   ♻️   Existing seeded listing found — reusing")
                return listing
            existing_prop.delete()

        # Property
        prop = Property.objects.create(
            host_user=host,
            apartment_type="2bhk",
            floor_number=3,
            total_floors=5,
            apartment_name=SEED_MARKER,
            address_line1="80 Feet Road, Koramangala 4th Block",
            city_name="Bengaluru",
            state="Karnataka",
            pincode=560034,
            latitude=Decimal("12.9352"),
            longitude=Decimal("77.6245"),
            google_place_id="ChIJLbZ-NFcWrjsR1d5iFxRFsWo",
            formatted_address="80 Feet Road, Koramangala 4th Block, Bengaluru, Karnataka 560034",
            gender_preference="any",
            title="Cozy Private Room in Koramangala 2BHK",
            description="Bright and airy private room in a well-furnished 2BHK. Located 5 minutes from Koramangala metro station.",
            status="live",
            published_at=timezone.now() - timedelta(days=30),
        )

        # Flatmates
        PropertyFlatmate.objects.create(
            property=prop,
            name="__host__",
            age=29,
            gender="male",
            occupation="Software Engineer",
            hobbies="Football, cooking, hiking",
            hometown="Jaipur",
        )
        PropertyFlatmate.objects.create(
            property=prop,
            name="Neha",
            age=26,
            gender="female",
            occupation="UX Designer",
            hobbies="Reading, yoga, travel",
            hometown="Pune",
        )

        # Room
        room = Room.objects.create(
            property=prop,
            room_label="Room 1",
            room_type="private",
            bed_type="double",
            bathroom_type="attached",
            max_guests=2,
            room_features=["wardrobe", "study_table", "window"],
        )

        # Listing
        listing = Listing.objects.create(
            host_user=host,
            property=prop,
            room=room,
            title="Cozy Private Room in Koramangala 2BHK",
            description=(
                "Bright and airy private room in a well-furnished 2BHK. "
                "High-speed WiFi, AC, fully equipped kitchen, and attached bathroom. "
                "5-minute walk to Koramangala metro and 10 minutes from major tech parks.\n\n"
                "Nearby: Metro station (5 min walk)"
            ),
            host_price_per_night=HOST_NIGHTLY,
            gst_pct=GST_PCT,
            platform_fee_pct=GUEST_FEE_PCT,
            min_nights=1,
            max_nights=30,
            booking_mode="request",
            food_kitchen_access=True,
            food_meals_available=True,
            food_meal_cost=Decimal("150.00"),
            food_meal_description="Home-cooked vegetarian meals (breakfast + dinner).",
            status="live",
            total_bookings=3,
            average_rating=Decimal("4.8"),
            review_count=1,
            published_at=timezone.now() - timedelta(days=30),
        )

        # Amenities
        amenity_names = ["WiFi", "AC", "Geyser / Hot water", "Full kitchen access", "Fridge", "Workspace / Desk"]
        amenity_defs = AmenityDefinition.objects.filter(display_name__in=amenity_names)
        ListingAmenity.objects.bulk_create([
            ListingAmenity(listing=listing, amenity=a) for a in amenity_defs
        ], ignore_conflicts=True)

        # House rules
        ListingHouseRules.objects.create(
            listing=listing,
            no_smoking=True,
            no_loud_music_after=time(22, 0),
            no_alcohol=False,
            no_pets=True,
            check_in_from=time(14, 0),
            check_in_until=time(22, 0),
            check_out_by=time(11, 0),
            cancellation_policy="moderate",
        )

        # Photos
        if not skip_photos:
            self.stdout.write("   📷  Downloading property photos…")
            for idx, (area, photo_id) in enumerate(PROPERTY_PHOTOS):
                res = _upload_photo(photo_id, folder=f"properties/{prop.id}/photos", filename=f"photo_{idx+1}.jpg")
                if res:
                    PropertyPhoto.objects.create(
                        property=prop,
                        room=room if area == "bedroom" else None,
                        area=area,
                        url=res["url"],
                        thumbnail_url=res.get("thumbnail_url", ""),
                        sort_order=idx,
                        is_cover=(idx == 0),
                        moderation_status="approved",
                    )
                    self.stdout.write(f"      ✓ {area} photo uploaded")
                else:
                    self.stdout.write(self.style.WARNING(f"      ⚠ Failed to download {area} photo — skipping"))

        return listing

    # ── Bookings ───────────────────────────────────────────────────────────────

    def _create_bookings(self, listing: Listing, host: User, guests: list[dict]) -> list[Booking]:
        today = date.today()

        booking_specs = [
            # (guest_idx, check_in, nights, status, payment_status, checked_in, checked_out)
            (0, today - timedelta(days=33), 3,  "completed", "paid", True,  True),
            (1, today - timedelta(days=2),  6,  "active",    "paid", True,  False),
            (2, today + timedelta(days=6),  2,  "accepted",  "paid", False, False),
        ]

        created = []
        for idx, (g_idx, check_in, nights, status, pay_status, checked_in, checked_out) in enumerate(booking_specs):
            guest_info = guests[g_idx]
            guest      = guest_info["user"]
            profile    = guest_info["profile"]
            check_out  = check_in + timedelta(days=nights)
            price      = calc_booking(nights)
            code       = f"RB-SEED{1000 + idx + 1}"

            # Skip if already exists
            existing = Booking.objects.filter(booking_code=code).first()
            if existing:
                created.append(existing)
                self.stdout.write(f"   ♻️   Booking {code} already exists — reusing")
                continue

            booking = Booking.objects.create(
                booking_code          = code,
                listing               = listing,
                guest_user            = guest,
                host_user             = host,
                guest_name            = f"{profile.first_name} {profile.last_name}",
                guest_email           = guest.email or f"{profile.first_name.lower()}@roombuddy.demo",
                guest_phone           = f"+91{guest_info['info']['phone']}",
                guest_gender          = profile.gender,
                check_in_date         = check_in,
                check_out_date        = check_out,
                number_of_guests      = 1,
                booking_mode          = "request",
                status                = status,
                payment_status        = pay_status,
                **price,
                meal_option_selected  = True,
                meal_cost_per_day     = Decimal("150.00"),
                meal_total            = Decimal("150.00") * nights,
                cancellation_policy   = "moderate",
                host_responded_at     = timezone.now() - timedelta(days=nights + 2),
                guest_checked_in_at   = (
                    timezone.make_aware(
                        timezone.datetime.combine(check_in, time(15, 0))
                    ) if checked_in else None
                ),
                guest_checked_out_at  = (
                    timezone.make_aware(
                        timezone.datetime.combine(check_out, time(11, 0))
                    ) if checked_out else None
                ),
                created_at            = timezone.now() - timedelta(days=nights + 5),
            )

            # Status history
            BookingStatusHistory.objects.create(
                booking=booking, from_status=None, to_status="pending",
                reason="Booking created by guest",
                changed_at=booking.created_at,
            )
            BookingStatusHistory.objects.create(
                booking=booking, from_status="pending", to_status="accepted",
                reason="Host accepted the booking",
                changed_by_user=host,
                changed_at=booking.created_at + timedelta(hours=2),
            )
            if status in ("active", "completed"):
                BookingStatusHistory.objects.create(
                    booking=booking, from_status="accepted", to_status="active",
                    reason="Guest checked in",
                    changed_at=booking.guest_checked_in_at,
                )
            if status == "completed":
                BookingStatusHistory.objects.create(
                    booking=booking, from_status="active", to_status="completed",
                    reason="Guest checked out",
                    changed_at=booking.guest_checked_out_at,
                )

            # Payment
            Payment.objects.create(
                booking              = booking,
                razorpay_order_id    = f"order_SEED_{code.replace('-', '_')}",
                razorpay_payment_id  = f"pay_SEED_{code.replace('-', '_')}",
                amount               = price["total_guest_pays"],
                currency             = "INR",
                method               = "upi",
                status               = "captured",
                captured_at          = booking.created_at + timedelta(minutes=5),
            )

            created.append(booking)
            guest_name = f"{profile.first_name} {profile.last_name}"
            self.stdout.write(f"   📋  Booking {code}: {guest_name} · {status} · {check_in} → {check_out}")

        return created

    # ── Conversations + Messages ────────────────────────────────────────────────

    def _create_conversations(self, host: User, guests: list[dict], bookings: list[Booking]):
        conv_messages = [
            # Priya (COMPLETED)
            [
                ("guest", "Hi Rahul! Super excited about the stay. Is there parking available?"),
                ("host",  "Hi Priya! Yes, we have 2-wheeler parking in the building. Welcome!"),
                ("guest", "Perfect. Will arrive around 3 PM on check-in day."),
                ("host",  "Great, I'll be home to welcome you. See you then!"),
                ("guest", "Had a wonderful stay, Rahul. The room was exactly as described!"),
                ("host",  "So glad to hear that! You're welcome back anytime, Priya."),
            ],
            # Arjun (ACTIVE)
            [
                ("guest", "Hey Rahul, can I check in a bit early, around 12 noon?"),
                ("host",  "Hi Arjun! Sure, that's fine. I'll leave the keys with security if I'm out."),
                ("guest", "Thanks! Also, is the WiFi password still the same?"),
                ("host",  "Yes, same as before — RoomBuddy@2024. Enjoy your stay!"),
                ("guest", "Great stay so far. Really appreciate the fast WiFi."),
            ],
            # Sneha (UPCOMING)
            [
                ("guest", "Hi! What time can I check in?"),
                ("host",  "Hi Sneha! Check-in is from 2 PM onwards. Let me know your arrival time!"),
                ("guest", "I'll be there by 3 PM. Is the AC available from day 1?"),
                ("host",  "Yes of course! AC is always on. Looking forward to hosting you."),
            ],
        ]

        for idx, (booking, guest_data) in enumerate(zip(bookings, guests)):
            conv, created = Conversation.objects.get_or_create(
                booking=booking,
                defaults={
                    "guest_user": guest_data["user"],
                    "host_user": host,
                },
            )
            if not created:
                continue

            base_time = timezone.now() - timedelta(days=30 - idx * 10)
            for msg_idx, (sender_role, body) in enumerate(conv_messages[idx]):
                sender = guest_data["user"] if sender_role == "guest" else host
                Message.objects.create(
                    conversation=conv,
                    sender_user=sender,
                    body=body,
                    created_at=base_time + timedelta(minutes=msg_idx * 30),
                )

            last_msg_time = base_time + timedelta(minutes=(len(conv_messages[idx]) - 1) * 30)
            conv.last_message_at = last_msg_time
            conv.guest_last_read_at = last_msg_time
            conv.host_last_read_at  = last_msg_time
            conv.save(update_fields=["last_message_at", "guest_last_read_at", "host_last_read_at"])

            self.stdout.write(f"   💬  Conversation with {guest_data['profile'].first_name} — {len(conv_messages[idx])} messages")

    # ── Reviews ────────────────────────────────────────────────────────────────

    def _create_reviews(self, booking: Booking, guest: User, host: User, listing: Listing):
        if Review.objects.filter(booking=booking).exists():
            self.stdout.write("   ♻️   Reviews already exist — skipping")
            return

        submitted = timezone.now() - timedelta(days=25)

        Review.objects.create(
            booking         = booking,
            reviewer_user   = guest,
            reviewee_user   = host,
            listing         = listing,
            review_type     = "guest_to_host",
            overall_rating  = 5,
            cleanliness_rating    = 5,
            accuracy_rating       = 5,
            communication_rating  = 5,
            location_rating       = 4,
            value_rating          = 5,
            title = "Absolutely loved the stay!",
            body  = (
                "Rahul is an amazing host! The room was spotless, AC worked perfectly, "
                "and the location is unbeatable — 5 mins walk to metro. "
                "Home-cooked meals were a lovely bonus. Highly recommend!"
            ),
            submitted_at = submitted,
            revealed_at  = submitted + timedelta(hours=1),
        )

        Review.objects.create(
            booking         = booking,
            reviewer_user   = host,
            reviewee_user   = guest,
            listing         = listing,
            review_type     = "host_to_guest",
            overall_rating  = 5,
            title = "Great guest!",
            body  = "Priya was a wonderful guest — respectful of the space and very communicative. Would host again!",
            submitted_at = submitted + timedelta(hours=2),
            revealed_at  = submitted + timedelta(hours=3),
        )

        self.stdout.write("   ⭐  Reviews created (5-star)")

    # ── Payout ─────────────────────────────────────────────────────────────────

    def _create_payout(self, host: User, completed_bookings: list[Booking]) -> Payout:
        if Payout.objects.filter(transfer_reference="SEED_PAYOUT_001").exists():
            self.stdout.write("   ♻️   Payout already exists — skipping")
            return Payout.objects.get(transfer_reference="SEED_PAYOUT_001")

        payout_account = PayoutAccount.objects.filter(user=host, is_primary=True).first()
        total = sum(b.total_host_receives for b in completed_bookings)

        completed_at = timezone.now() - timedelta(days=20)
        payout = Payout.objects.create(
            host_user          = host,
            payout_account     = payout_account,
            amount             = total,
            currency           = "INR",
            status             = "completed",
            method             = "manual_bank",
            transfer_reference = "SEED_PAYOUT_001",
            period_start       = date.today() - timedelta(days=35),
            period_end         = date.today() - timedelta(days=28),
            notes              = "Payout for completed booking RB-SEED1001",
            initiated_at       = completed_at,
            completed_at       = completed_at,
        )
        payout.bookings.set(completed_bookings)
        self.stdout.write(f"   💰  Payout ₹{total} — completed")
        return payout
