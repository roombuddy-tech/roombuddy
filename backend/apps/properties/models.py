import uuid

from django.db import models


class Property(models.Model):
    class ApartmentType(models.TextChoices):
        BHK_1 = "1bhk"
        BHK_2 = "2bhk"
        BHK_3 = "3bhk"
        BHK_4 = "4bhk"

    class GenderPreference(models.TextChoices):
        MALE_ONLY = "male_only"
        FEMALE_ONLY = "female_only"
        ANY = "any"

    class OwnershipType(models.TextChoices):
        OWNER_OCCUPIED = "owner_occupied"
        TENANT = "tenant"
        LANDLORD_CONSENT = "landlord_consent"

    class Status(models.TextChoices):
        DRAFT = "draft"
        PENDING_REVIEW = "pending_review"
        LIVE = "live"
        PAUSED = "paused"
        REJECTED = "rejected"
        DELISTED = "delisted"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    host_user = models.ForeignKey(
        "users.User", on_delete=models.RESTRICT, related_name="properties",
    )
    apartment_type = models.CharField(max_length=20, choices=ApartmentType.choices)
    floor_number = models.SmallIntegerField()
    total_floors = models.SmallIntegerField(null=True, blank=True)
    apartment_name = models.CharField(max_length=255)

    # Location (switch to PointField when GDAL/PostGIS is available)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    google_place_id = models.CharField(max_length=300, null=True, blank=True)
    formatted_address = models.TextField(null=True, blank=True)
    address_line1 = models.CharField(max_length=255, null=True, blank=True)
    address_line2 = models.CharField(max_length=255, null=True, blank=True)
    city_id = models.UUIDField()
    neighborhood_id = models.UUIDField(null=True, blank=True)
    city_name = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10)

    # Content
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)

    # Preferences
    gender_preference = models.CharField(
        max_length=20, choices=GenderPreference.choices, default=GenderPreference.ANY,
    )

    # Legal
    ownership_type = models.CharField(
        max_length=20, choices=OwnershipType.choices, default=OwnershipType.TENANT,
    )
    landlord_consent_url = models.URLField(max_length=2048, null=True, blank=True)

    # State
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    rejection_reason = models.TextField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "properties"
        verbose_name_plural = "properties"
        indexes = [
            models.Index(fields=["host_user"], name="idx_properties_host"),
            models.Index(fields=["city_id"], name="idx_properties_city"),
            models.Index(fields=["status"], name="idx_properties_status"),
        ]

    def __str__(self):
        return self.title


class PropertyFlatmate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="flatmates",
    )
    name = models.CharField(max_length=150)
    age = models.SmallIntegerField(null=True, blank=True)
    gender = models.CharField(max_length=20, null=True, blank=True)
    occupation = models.CharField(max_length=150, null=True, blank=True)
    hobbies = models.TextField(null=True, blank=True)
    is_visible = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "property_flatmates"
        indexes = [
            models.Index(fields=["property"], name="idx_flatmates_property"),
        ]

    def __str__(self):
        return self.name


class PropertyPhoto(models.Model):
    class Area(models.TextChoices):
        BEDROOM = "bedroom"
        WASHROOM = "washroom"
        KITCHEN = "kitchen"
        LIVING_ROOM = "living_room"
        OTHER = "other"

    class ModerationStatus(models.TextChoices):
        PENDING = "pending"
        APPROVED = "approved"
        REJECTED = "rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="photos",
    )
    room = models.ForeignKey(
        "rooms.Room", on_delete=models.CASCADE, null=True, blank=True, related_name="photos",
    )
    area = models.CharField(max_length=30, choices=Area.choices)
    url = models.URLField(max_length=2048)
    thumbnail_url = models.URLField(max_length=2048, null=True, blank=True)
    caption = models.CharField(max_length=255, null=True, blank=True)
    sort_order = models.SmallIntegerField(default=0)
    is_cover = models.BooleanField(default=False)
    moderation_status = models.CharField(
        max_length=20, choices=ModerationStatus.choices, default=ModerationStatus.PENDING,
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "property_photos"
        indexes = [
            models.Index(fields=["property"], name="idx_photos_property"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["property"],
                condition=models.Q(is_cover=True),
                name="uniq_cover_photo",
            ),
        ]

    def __str__(self):
        return f"Photo {self.id} – {self.area}"
