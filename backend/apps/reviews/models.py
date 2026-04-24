import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Review(models.Model):
    class ReviewType(models.TextChoices):
        GUEST_TO_HOST = "guest_to_host"
        HOST_TO_GUEST = "host_to_guest"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(
        "bookings.Booking", on_delete=models.CASCADE, related_name="reviews",
    )
    reviewer_user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="reviews_given",
    )
    reviewee_user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="reviews_received",
    )
    listing = models.ForeignKey(
        "listings.Listing", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="reviews",
    )
    review_type = models.CharField(max_length=20, choices=ReviewType.choices)
    overall_rating = models.SmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    cleanliness_rating = models.SmallIntegerField(null=True, blank=True)
    accuracy_rating = models.SmallIntegerField(null=True, blank=True)
    communication_rating = models.SmallIntegerField(null=True, blank=True)
    location_rating = models.SmallIntegerField(null=True, blank=True)
    value_rating = models.SmallIntegerField(null=True, blank=True)
    food_rating = models.SmallIntegerField(null=True, blank=True)
    title = models.CharField(max_length=255, null=True, blank=True)
    body = models.TextField(null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    revealed_at = models.DateTimeField(null=True, blank=True)
    host_response = models.TextField(null=True, blank=True)
    host_responded_at = models.DateTimeField(null=True, blank=True)
    is_hidden = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "reviews"
        constraints = [
            models.UniqueConstraint(
                fields=["booking", "review_type"],
                name="uq_reviews_booking_type",
            ),
            models.CheckConstraint(
                condition=models.Q(overall_rating__gte=1, overall_rating__lte=5),
                name="valid_rating",
            ),
        ]
        indexes = [
            models.Index(fields=["listing"], name="idx_reviews_listing"),
        ]

    def __str__(self):
        return f"Review {self.id} – {self.review_type}"
