from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.bookings.serializers import HostBookingsResponseSerializer, HostEarningsResponseSerializer
from apps.bookings.services import get_host_bookings, get_host_earnings
from common.authentication import JWTAuthentication
from common.permissions import IsAuthenticated


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