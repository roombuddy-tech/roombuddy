"""
Core API views.

Contains health check and system-level endpoints.
Each view follows the Single Responsibility Principle.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema
from core.api.serializers import HealthCheckSerializer


class HealthCheckView(APIView):
    """
    Health check endpoint to verify the backend is running.
    
    Returns service status, version, and a welcome message.
    No authentication required.
    """
    
    authentication_classes = []
    permission_classes = []

    @extend_schema(
        tags=["Health"],
        summary="Health check",
        description=(
            "Returns a simple response confirming the RoomBuddy backend "
            "is up and running. Use this endpoint to verify connectivity."
        ),
        responses={200: HealthCheckSerializer},
    )
    def get(self, request):
        data = {
            "status": "healthy",
            "message": "RoomBuddy backend is ready and running!",
            "version": "1.0.0",
            "service": "roombuddy-api",
        }
        serializer = HealthCheckSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)
