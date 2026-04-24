import uuid

from django.db import models


class Room(models.Model):
    class RoomType(models.TextChoices):
        PRIVATE = "private"
        SHARED = "shared"

    class BedType(models.TextChoices):
        SINGLE = "single"
        DOUBLE = "double"
        QUEEN = "queen"
        KING = "king"
        MATTRESS = "mattress"

    class BathroomType(models.TextChoices):
        ATTACHED = "attached"
        SHARED = "shared"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    property = models.ForeignKey(
        "properties.Property", on_delete=models.CASCADE, related_name="rooms",
    )
    room_label = models.CharField(max_length=50, default="Room")
    room_type = models.CharField(max_length=20, choices=RoomType.choices)
    bed_type = models.CharField(max_length=30, choices=BedType.choices)
    bed_count = models.SmallIntegerField(default=1)
    max_guests = models.SmallIntegerField(default=1)
    bathroom_type = models.CharField(max_length=20, choices=BathroomType.choices)
    room_features = models.JSONField(default=dict)
    room_size_sqft = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rooms"
        constraints = [
            models.UniqueConstraint(
                fields=["property", "room_label"],
                name="uq_rooms_property_label",
            ),
        ]
        indexes = [
            models.Index(fields=["property"], name="idx_rooms_property"),
        ]

    def __str__(self):
        return f"{self.room_label} – {self.property_id}"
