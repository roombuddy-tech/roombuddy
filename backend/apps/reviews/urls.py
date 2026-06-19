from django.urls import path
from apps.reviews.views import (
    ListingReviewsView,
    MyReviewView,
    ReviewEligibilityView,
    SubmitReviewView,
)

urlpatterns = [
    path("bookings/<uuid:booking_id>/", SubmitReviewView.as_view()),
    path("bookings/<uuid:booking_id>/eligibility/", ReviewEligibilityView.as_view()),
    path("bookings/<uuid:booking_id>/mine/", MyReviewView.as_view()),
    path("listings/<uuid:listing_id>/", ListingReviewsView.as_view()),
]
