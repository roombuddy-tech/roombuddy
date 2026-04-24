import uuid

from django.db import models

_property = property


class Listing(models.Model):
    class BookingMode(models.TextChoices):
        INSTANT = "instant"
        REQUEST = "request"

    class Status(models.TextChoices):
        DRAFT = "draft"
        LIVE = "live"
        PAUSED = "paused"
        SNOOZED = "snoozed"
        DELISTED = "delisted"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(
        "rooms.Room", on_delete=models.CASCADE, related_name="listings",
    )
    property = models.ForeignKey(
        "properties.Property", on_delete=models.CASCADE, related_name="listings",
    )
    host_user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="listings",
    )

    # Content
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)

    # Pricing
    host_price_per_night = models.DecimalField(max_digits=10, decimal_places=2)
    gst_pct = models.DecimalField(max_digits=5, decimal_places=2, default=12.00)
    platform_fee_pct = models.DecimalField(max_digits=5, decimal_places=2, default=10.00)
    currency = models.CharField(max_length=3, default="INR")

    # Discounts
    weekly_discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    monthly_discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Stay rules
    min_nights = models.SmallIntegerField(default=1)
    max_nights = models.SmallIntegerField(default=30)
    advance_notice_hours = models.SmallIntegerField(default=24, null=True, blank=True)

    # Booking mode
    booking_mode = models.CharField(
        max_length=20, choices=BookingMode.choices, default=BookingMode.REQUEST,
    )
    security_deposit = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Food options
    food_kitchen_access = models.BooleanField(default=False)
    food_meals_available = models.BooleanField(default=False)
    food_meal_cost = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    food_meal_description = models.TextField(null=True, blank=True)

    # State
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    snoozed_until = models.DateField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)

    # Cached stats
    total_bookings = models.IntegerField(default=0)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    review_count = models.IntegerField(default=0)
    view_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @_property
    def guest_price_per_night(self):
        return round(
            self.host_price_per_night * (1 + self.gst_pct / 100 + self.platform_fee_pct / 100), 2
        )

    class Meta:
        db_table = "listings"
        indexes = [
            models.Index(fields=["host_user"], name="idx_listings_host"),
            models.Index(fields=["status"], name="idx_listings_status"),
            models.Index(fields=["property"], name="idx_listings_property"),
        ]

    def __str__(self):
        return self.title


class ListingAmenity(models.Model):
    listing = models.ForeignKey(
        Listing, on_delete=models.CASCADE, related_name="listing_amenities",
    )
    amenity = models.ForeignKey(
        "amenities.AmenityDefinition", on_delete=models.CASCADE, related_name="listing_amenities",
    )
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "listing_amenities"
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "amenity"],
                name="pk_listing_amenities",
            ),
        ]

    def __str__(self):
        return f"{self.listing_id} – {self.amenity_id}"


class ListingHouseRules(models.Model):
    class CancellationPolicy(models.TextChoices):
        FLEXIBLE = "flexible"
        MODERATE = "moderate"
        STRICT = "strict"

    listing = models.OneToOneField(
        Listing, on_delete=models.CASCADE, primary_key=True, related_name="house_rules",
    )
    no_smoking = models.BooleanField(default=True)
    no_loud_music_after = models.TimeField(default="22:00")
    no_alcohol = models.BooleanField(default=False)
    no_pets = models.BooleanField(default=True)
    no_visitors = models.BooleanField(default=False)
    no_overnight_guests = models.BooleanField(default=True)
    min_guest_age = models.SmallIntegerField(default=18)
    custom_rules = models.TextField(null=True, blank=True)
    check_in_from = models.TimeField(default="14:00")
    check_in_until = models.TimeField(default="22:00")
    check_out_by = models.TimeField(default="11:00")
    cancellation_policy = models.CharField(
        max_length=20, choices=CancellationPolicy.choices, default=CancellationPolicy.MODERATE,
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "listing_house_rules"
        verbose_name_plural = "listing house rules"

    def __str__(self):
        return f"Rules – {self.listing_id}"
