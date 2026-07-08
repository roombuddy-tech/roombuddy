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
    delete_listing, update_blocked_dates, toggle_snooze,
    search_guest_listings, get_guest_listing_detail,
)
from common.authentication import JWTAuthentication
from common.permissions import IsAuthenticated
from rest_framework.permissions import AllowAny
import logging

logger = logging.getLogger(__name__)


class HostListingsListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Host"], responses={200: HostListingsResponseSerializer})
    def get(self, request):
        results = get_host_listings(request.user)
        aadhaar_verified = False
        id_verification_status = "not_submitted"
        try:
            profile = request.user.profile
            aadhaar_verified = profile.id_verification_status == "approved"
            id_verification_status = profile.id_verification_status
        except Exception:
            pass
        return Response({
            "count": len(results),
            "results": results,
            "aadhaar_verified": aadhaar_verified,
            "id_verification_status": id_verification_status,
        })


class CreateListingView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Host"],
        request=CreateListingRequestSerializer,
        responses={201: CreateListingResponseSerializer},
    )
    def post(self, request):
        s = CreateListingRequestSerializer(data=request.data)
        if not s.is_valid():
            logger.warning("Listing validation errors: %s", s.errors)
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

    @extend_schema(tags=["Host"])
    def delete(self, request, listing_id):
        deleted = delete_listing(request.user, str(listing_id))
        if not deleted:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"detail": "Listing deleted."}, status=status.HTTP_200_OK)


class ListingBlockedDatesView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Host"])
    def patch(self, request, listing_id):
        blocked_dates = request.data.get("blocked_dates", [])
        result = update_blocked_dates(request.user, str(listing_id), blocked_dates)
        if result is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(result)


class ListingSnoozeView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Host"])
    def patch(self, request, listing_id):
        result = toggle_snooze(request.user, str(listing_id))
        if result is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(result)


class GuestSearchView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [AllowAny]

    @extend_schema(tags=["Guest"])
    def get(self, request):
        q = request.query_params.get("q")
        area = request.query_params.get("area")
        check_in = request.query_params.get("check_in")
        check_out = request.query_params.get("check_out")
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")
        results = search_guest_listings(
            query=q, area=area, check_in=check_in, check_out=check_out,
            lat=float(lat) if lat else None,
            lng=float(lng) if lng else None,
        )
        return Response({"count": len(results), "results": results})


class GuestListingDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [AllowAny]

    @extend_schema(tags=["Guest"])
    def get(self, request, listing_id):
        viewer = request.user if request.auth else None
        data = get_guest_listing_detail(str(listing_id), viewer=viewer)
        if data is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(data)
