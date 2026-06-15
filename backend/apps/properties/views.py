from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.properties.services import upload_property_photo
from common.authentication import JWTAuthentication
from common.permissions import IsAuthenticated
from third_party.storage import StorageError
import logging

logger = logging.getLogger(__name__)

VALID_AREAS = {"bedroom", "washroom", "kitchen", "living_room", "other"}


class PropertyPhotoUploadView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    @extend_schema(tags=["Host"])
    def post(self, request, property_id):
        if "image" not in request.FILES:
            return Response(
                {"error": "No image file provided. Send as 'image' in form-data."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        image_file = request.FILES["image"]
        area = request.data.get("area", "other")
        if area not in VALID_AREAS:
            area = "other"
        is_cover = str(request.data.get("is_cover", "false")).lower() == "true"

        try:
            result = upload_property_photo(request.user, str(property_id), image_file, area, is_cover)
        except StorageError as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)

        if result is None:
            return Response({"error": "Property not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_201_CREATED)
