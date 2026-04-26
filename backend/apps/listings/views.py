from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.listings.serializers import HostListingsResponseSerializer
from apps.listings.services import get_host_listings
from common.authentication import JWTAuthentication
from common.permissions import IsAuthenticated


class HostListingsListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Host"], responses={200: HostListingsResponseSerializer})
    def get(self, request):
        results = get_host_listings(request.user)
        return Response({"count": len(results), "results": results})