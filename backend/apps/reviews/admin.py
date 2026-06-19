from django.contrib import admin
from apps.reviews.models import Review
import logging

logger = logging.getLogger(__name__)


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "review_type", "reviewer_user", "reviewee_user", "overall_rating", "submitted_at")
    list_filter = ("review_type", "overall_rating")

    