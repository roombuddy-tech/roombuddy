from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers as s
from drf_spectacular.utils import extend_schema, inline_serializer, OpenApiParameter

from apps.bookings.models import Booking
from common.authentication import JWTAuthentication
from common.permissions import IsAuthenticated


class HostBookingsListView(APIView):
    """
    GET /api/bookings/host/
    Authenticated endpoint. Lists all bookings where the user is the host.
    Supports filtering by status: all, active, upcoming, completed.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Host"],
        parameters=[
            OpenApiParameter(
                name="status",
                description="Filter by status: all, active, upcoming, completed",
                required=False,
                type=str,
                default="all",
            ),
        ],
        responses={
            200: inline_serializer("HostBookingsListResponse", fields={
                "count": s.IntegerField(),
                "results": s.ListField(child=s.DictField()),
            }),
        },
    )
    def get(self, request):
        user = request.user
        status_filter = request.query_params.get("status", "all").lower()

        queryset = Booking.objects.filter(
            host_user=user
        ).select_related("guest_user").order_by("-created_at")

        if status_filter == "active":
            queryset = queryset.filter(status__in=["active", "accepted"])
        elif status_filter == "upcoming":
            queryset = queryset.filter(status__in=["pending", "accepted"])
        elif status_filter == "completed":
            queryset = queryset.filter(status="completed")

        results = []
        for b in queryset:
            guest_first = ""
            guest_last = ""
            try:
                guest_first = b.guest_user.profile.first_name
                guest_last = b.guest_user.profile.last_name
            except Exception:
                pass

            guest_name = f"{guest_first} {guest_last[0]}." if guest_last else guest_first or "Guest"
            initials = f"{guest_first[0] if guest_first else ''}{guest_last[0] if guest_last else ''}".upper()

            results.append({
                "booking_id": str(b.id),
                "booking_code": b.booking_code,
                "guest_name": guest_name,
                "guest_initials": initials or "G",
                "check_in_date": b.check_in_date.isoformat(),
                "check_out_date": b.check_out_date.isoformat(),
                "nights": b.nights,
                "guest_purpose": b.guest_purpose,
                "status": b.status,
                "total_guest_pays": float(b.total_guest_pays),
                "total_host_receives": float(b.total_host_receives),
            })

        return Response({
            "count": len(results),
            "results": results,
        })