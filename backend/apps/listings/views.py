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
        q = request.query_params.get("q")
        area = request.query_params.get("area")
        results = search_guest_listings(query=q, area=area)
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
