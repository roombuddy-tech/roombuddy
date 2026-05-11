from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.listings.serializers import (
    CreateListingRequestSerializer,
    CreateListingResponseSerializer,
    HostListingsResponseSerializer,
)
from apps.listings.services import (
    create_listing, get_host_listings, get_listing_form_data, update_listing,
    search_guest_listings, get_guest_listing_detail,
    get_blocked_periods, create_blocked_period, delete_blocked_period,
)
from common.authentication import JWTAuthentication
from common.permissions import IsAuthenticated


class HostListingsListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Host"], responses={200: HostListingsResponseSerializer})
    def get(self, request):
        results = get_host_listings(request.user)
        return Response({"count": len(results), "results": results})


class CreateListingView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Host"],
        request=CreateListingRequestSerializer,
        responses={201: CreateListingResponseSerializer},
    )
    def post(self, request):
        result = create_listing(request.user, request.data)
        return Response(result, status=status.HTTP_201_CREATED)


class ListingDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Host"])
    def get(self, request, listing_id):
        data = get_listing_form_data(request.user, listing_id)
        if data is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(data)

    @extend_schema(tags=["Host"], request=CreateListingRequestSerializer, responses={200: CreateListingResponseSerializer})
    def patch(self, request, listing_id):
        result = update_listing(request.user, listing_id, request.data)
        if result is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(result)


class GuestSearchView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Guest"])
    def get(self, request):
        from datetime import date as date_type

        q = request.query_params.get("q")
        area = request.query_params.get("area")

        check_in_date = None
        check_out_date = None
        ci_str = request.query_params.get("check_in_date")
        co_str = request.query_params.get("check_out_date")
        if ci_str and co_str:
            try:
                check_in_date = date_type.fromisoformat(ci_str)
                check_out_date = date_type.fromisoformat(co_str)
            except ValueError:
                pass

        results = search_guest_listings(
            query=q,
            area=area,
            check_in_date=check_in_date,
            check_out_date=check_out_date,
        )
        return Response({"count": len(results), "results": results})


class GuestListingDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Guest"])
    def get(self, request, listing_id):
        data = get_guest_listing_detail(str(listing_id))
        if data is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(data)


class BlockedPeriodsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, listing_id):
        periods = get_blocked_periods(request.user, str(listing_id))
        return Response({"count": len(periods), "results": periods})

    def post(self, request, listing_id):
        start = request.data.get("start_date")
        end = request.data.get("end_date")
        reason = request.data.get("reason")
        if not start or not end:
            return Response({"error": "start_date and end_date are required"}, status=status.HTTP_400_BAD_REQUEST)
        from datetime import date as dt_date
        try:
            start_date = dt_date.fromisoformat(start)
            end_date = dt_date.fromisoformat(end)
        except ValueError:
            return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        result = create_blocked_period(request.user, str(listing_id), start_date, end_date, reason)
        return Response(result, status=status.HTTP_201_CREATED)


class BlockedPeriodDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, listing_id, period_id):
        delete_blocked_period(request.user, str(listing_id), str(period_id))
        return Response(status=status.HTTP_204_NO_CONTENT)
