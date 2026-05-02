from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiParameter

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
    get_host_bookings,
    get_host_earnings,
    quote_booking,
)
from common.authentication import JWTAuthentication
from common.permissions import IsAuthenticated


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
        )
        return Response(result)


class CreateBookingView(APIView):
    """Create a new booking in pending state."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

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
            )
        except BookingConflictError as e:
            return Response(
                {"error": str(e), "code": "BOOKING_CONFLICT"},
                status=status.HTTP_409_CONFLICT,
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
        }, status=status.HTTP_201_CREATED)


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
                {"error": "Booking not found", "code": "NOT_FOUND"},
                status=status.HTTP_404_NOT_FOUND,
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


class HostBookingsListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Host"],
        parameters=[
            OpenApiParameter(name="status", description="Filter: all, active, upcoming, completed", required=False, type=str, default="all"),
        ],
        responses={200: HostBookingsResponseSerializer},
    )
    def get(self, request):
        status_filter = request.query_params.get("status", "all").lower()
        results = get_host_bookings(request.user, status_filter)
        return Response({"count": len(results), "results": results})


class HostEarningsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Host"], responses={200: HostEarningsResponseSerializer})
    def get(self, request):
        result = get_host_earnings(request.user)
        return Response(result)