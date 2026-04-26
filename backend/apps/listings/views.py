from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers as s
from drf_spectacular.utils import extend_schema, inline_serializer

from apps.listings.models import Listing
from common.authentication import JWTAuthentication
from common.permissions import IsAuthenticated


class HostListingsListView(APIView):
    """
    GET /api/listings/host/
    Authenticated endpoint. Returns all listings owned by the host.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Host"],
        responses={
            200: inline_serializer("HostListingsResponse", fields={
                "count": s.IntegerField(),
                "results": s.ListField(child=s.DictField()),
            }),
        },
    )
    def get(self, request):
        user = request.user

        listings = Listing.objects.filter(
            host_user=user
        ).select_related("property", "room").order_by("-created_at")

        results = []
        for listing in listings:
            # Get area/location name
            area_name = ""
            try:
                prop = listing.property
                if prop.formatted_address:
                    area_name = prop.formatted_address.split(",")[0]
                elif prop.apartment_name:
                    area_name = prop.apartment_name
                else:
                    area_name = prop.city_name
            except Exception:
                area_name = ""

            results.append({
                "listing_id": str(listing.id),
                "title": listing.title,
                "area_name": area_name,
                "host_price_per_night": float(listing.host_price_per_night),
                "guest_price_per_night": float(listing.guest_price_per_night),
                "status": listing.status,
                "average_rating": float(listing.average_rating) if listing.average_rating else None,
                "review_count": listing.review_count,
                "total_bookings": listing.total_bookings,
                "cover_photo_url": None,
            })

        # Try to get cover photos
        if results:
            from apps.properties.models import PropertyPhoto
            listing_property_map = {}
            for listing in listings:
                listing_property_map[str(listing.id)] = listing.property_id

            property_ids = list(set(listing_property_map.values()))
            cover_photos = PropertyPhoto.objects.filter(
                property_id__in=property_ids,
                is_cover=True,
            ).values("property_id", "url")

            photo_map = {str(p["property_id"]): p["url"] for p in cover_photos}

            for r in results:
                prop_id = str(listing_property_map.get(r["listing_id"], ""))
                r["cover_photo_url"] = photo_map.get(prop_id)

        return Response({
            "count": len(results),
            "results": results,
        })