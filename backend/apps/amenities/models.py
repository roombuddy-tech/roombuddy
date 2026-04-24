import uuid

from django.db import models


class AmenityCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=30, unique=True)
    display_name = models.CharField(max_length=100)
    display_order = models.SmallIntegerField(default=0)
    icon = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = "amenity_categories"
        verbose_name_plural = "amenity categories"
        ordering = ["display_order"]

    def __str__(self):
        return self.display_name


class AmenityDefinition(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(
        AmenityCategory, on_delete=models.CASCADE, related_name="amenities",
    )
    code = models.CharField(max_length=60, unique=True)
    display_name = models.CharField(max_length=150)
    icon = models.CharField(max_length=100, null=True, blank=True)
    is_popular = models.BooleanField(default=False)
    display_order = models.SmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "amenity_definitions"
        ordering = ["display_order"]

    def __str__(self):
        return self.display_name
