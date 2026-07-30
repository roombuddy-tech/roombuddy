from rest_framework import status as http_status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.bookings.models import Booking
from apps.bookings.serializers import (
    BookingDetailSerializer,
    CancelBookingRequestSerializer,
    CancelBookingResponseSerializer,
    CreateBookingRequestSerializer,
    HostBookingsResponseSerializer,
    HostEarningsResponseSerializer,
    QuoteRequestSerializer,
    QuoteResponseSerializer,
)
from apps.bookings.services import (
    BookingConflictError,
    cancel_booking,
    create_booking,
    get_booking_detail,
    get_guest_bookings,
    get_host_bookings,
    get_host_earnings,
    quote_booking,
    accept_booking,
    reject_booking,
)
from common.authentication import JWTAuthentication
from common.error_codes import ErrorCode
from common.permissions import IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
import logging

logger = logging.getLogger(__name__)


class BookingQuoteView(APIView):
    """Returns price breakdown without creating a booking. Used to show price before confirming."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Booking"],
        request=QuoteRequestSerializer,
        responses={200: QuoteResponseSerializer},
    )
    def post(self, request):
        s = QuoteRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        result = quote_booking(
            s.validated_data["listing_id"],
            s.validated_data["check_in_date"],
            s.validated_data["check_out_date"],
            meal_option=s.validated_data.get("meal_option", False),
        )
        return Response(result)


class CreateBookingView(APIView):
    """Create a new booking in pending state."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "booking_create"

    @extend_schema(
        tags=["Booking"],
        request=CreateBookingRequestSerializer,
        responses={201: BookingDetailSerializer},
    )
    def post(self, request):
        s = CreateBookingRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            booking = create_booking(
                user=request.user,
                listing_id=s.validated_data["listing_id"],
                check_in=s.validated_data["check_in_date"],
                check_out=s.validated_data["check_out_date"],
                number_of_guests=s.validated_data["number_of_guests"],
                guest_purpose=s.validated_data.get("guest_purpose"),
                special_requests=s.validated_data.get("special_requests"),
                meal_option=s.validated_data.get("meal_option", False),
            )
        except BookingConflictError as e:
            return Response(
                {"error": str(e), "code": ErrorCode.BOOKING_CONFLICT},
                status=http_status.HTTP_409_CONFLICT,
            )

        return Response({
            "booking_id": str(booking.id),
            "booking_code": booking.booking_code,
            "status": booking.status,
            "payment_status": booking.payment_status,
            "check_in_date": booking.check_in_date.isoformat(),
            "check_out_date": booking.check_out_date.isoformat(),
            "nights": booking.nights,
            "total_guest_pays": float(booking.total_guest_pays),
            "total_host_receives": float(booking.total_host_receives),
            "cancellation_policy": booking.cancellation_policy,
        }, status=http_status.HTTP_201_CREATED)


class CancelBookingView(APIView):
    """Cancel a booking. Refund (if any) happens automatically."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Booking"],
        request=CancelBookingRequestSerializer,
        responses={200: CancelBookingResponseSerializer},
    )
    def post(self, request, booking_id):
        try:
            booking = Booking.objects.get(id=booking_id)
        except Booking.DoesNotExist:
            return Response(
                {"error": "Booking not found", "code": ErrorCode.NOT_FOUND},
                status=http_status.HTTP_404_NOT_FOUND,
            )
        s = CancelBookingRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        booking = cancel_booking(booking, request.user, s.validated_data["reason"])
        return Response({
            "booking_id": str(booking.id),
            "status": booking.status,
            "payment_status": booking.payment_status,
            "refund_amount": float(booking.refund_amount or 0),
        })


class BookingDetailView(APIView):
    """
    GET full details of a single booking.

    Authorisation: only the booking's guest or host can fetch.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Booking"], responses={200: dict})
    def get(self, request, booking_id):
        try:
            booking = (
                Booking.objects
                .select_related("guest_user", "host_user", "listing")
                .get(id=booking_id)
            )
        except Booking.DoesNotExist:
            return Response(
                {"error": "Booking not found", "code": ErrorCode.NOT_FOUND},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        if request.user.id not in (booking.guest_user_id, booking.host_user_id):
            return Response(
                {"error": "Not allowed", "code": ErrorCode.FORBIDDEN},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        return Response(get_booking_detail(booking))


class GuestBookingsListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Guest"])
    def get(self, request):
        results = get_guest_bookings(request.user)
        return Response({"count": len(results), "results": results})


class HostBookingsListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Host"],
        parameters=[
            OpenApiParameter(
                name="status",
                description="Filter by status group",
                required=False,
                type=str,
                enum=Booking.HostBookingFilter.values,
                default=Booking.HostBookingFilter.ALL,
            ),
        ],
        responses={200: HostBookingsResponseSerializer},
    )
    def get(self, request):
        status_filter = request.query_params.get(
            "status", Booking.HostBookingFilter.ALL,
        ).lower()
        results = get_host_bookings(request.user, status_filter)
        return Response({"count": len(results), "results": results})


class HostEarningsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Host"], responses={200: HostEarningsResponseSerializer})
    def get(self, request):
        result = get_host_earnings(request.user)
        return Response(result)

class HostRespondBookingView(APIView):
    """POST /api/bookings/<booking_id>/respond/  — host accepts or declines."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, booking_id):
        action = request.data.get("action")  # "accept" or "decline"
        if action not in ("accept", "decline"):
            return Response(
                {"detail": "action must be 'accept' or 'decline'."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        try:
            booking = Booking.objects.select_related(
                "listing", "guest_user", "host_user"
            ).get(id=booking_id, host_user=request.user)
        except Booking.DoesNotExist:
            return Response({"detail": "Booking not found."}, status=http_status.HTTP_404_NOT_FOUND)

        if booking.status != Booking.Status.PENDING:
            return Response(
                {"detail": f"Cannot respond to a booking with status '{booking.status}'."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        try:
            if action == "accept":
                booking = accept_booking(booking, request.user)
            else:
                reason = request.data.get("reason", "")
                booking = reject_booking(booking, request.user, reason=reason)
            return Response({"status": booking.status})
        except Exception:
            logger.exception("HostRespondBookingView failed booking_id=%s", booking_id)
            return Response({"detail": "Failed to process response."}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
