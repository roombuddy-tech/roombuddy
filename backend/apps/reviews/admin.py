from django.contrib import admin
from apps.reviews.models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ["id", "review_type", "reviewer_user", "reviewee_user", "overall_rating", "submitted_at", "is_hidden"]
    list_filter = ["review_type", "is_hidden"]
    search_fields = ["reviewer_user__phone_number", "reviewee_user__phone_number", "body"]
    readonly_fields = ["submitted_at", "created_at"]
    actions = ["hide_reviews", "unhide_reviews"]

    def hide_reviews(self, request, qs):
        qs.update(is_hidden=True)
    hide_reviews.short_description = "Hide selected reviews"

    def unhide_reviews(self, request, qs):
        qs.update(is_hidden=False)
    unhide_reviews.short_description = "Unhide selected reviews"
