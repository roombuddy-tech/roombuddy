import logging

from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from apps.bookings.models import Booking
from apps.reviews.serializers import SubmitReviewSerializer
from apps.reviews.services import (
    can_guest_review,
    get_listing_reviews,
    get_my_review_for_booking,
    submit_guest_review,
)
from common.authentication import JWTAuthentication
from common.permissions import IsAuthenticated

logger = logging.getLogger(__name__)


class SubmitReviewView(APIView):
    """POST /api/reviews/bookings/<booking_id>/  — guest submits a review."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, booking_id):
        try:
            booking = Booking.objects.select_related(
                "guest_user", "host_user", "listing"
            ).get(id=booking_id)
        except Booking.DoesNotExist:
            return Response({"detail": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

        eligibility = can_guest_review(booking, request.user)
        if not eligibility["eligible"]:
            return Response(
                {"detail": eligibility["reason"]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        s = SubmitReviewSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            review = submit_guest_review(booking, request.user, s.validated_data)
            return Response(review, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            logger.exception("submit_guest_review failed booking_id=%s", booking_id)
            return Response({"detail": "Failed to submit review."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ReviewEligibilityView(APIView):
    """GET /api/reviews/bookings/<booking_id>/eligibility/  — can this guest review?"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, booking_id):
        try:
            booking = Booking.objects.get(id=booking_id)
        except Booking.DoesNotExist:
            return Response({"eligible": False, "reason": "booking_not_found"})
        return Response(can_guest_review(booking, request.user))


class MyReviewView(APIView):
    """GET /api/reviews/bookings/<booking_id>/mine/  — fetch guest's own review."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, booking_id):
        try:
            booking = Booking.objects.get(id=booking_id, guest_user=request.user)
        except Booking.DoesNotExist:
            return Response({"detail": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)
        review = get_my_review_for_booking(booking, request.user)
        return Response({"review": review})


class ListingReviewsView(APIView):
    """GET /api/reviews/listings/<listing_id>/  — public listing reviews."""

    def get(self, request, listing_id):
        limit = min(int(request.query_params.get("limit", 20)), 50)
        offset = int(request.query_params.get("offset", 0))
        return Response(get_listing_reviews(listing_id, limit=limit, offset=offset))
