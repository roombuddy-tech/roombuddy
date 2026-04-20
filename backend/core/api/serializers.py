"""
Core API serializers.

Defines the data structure for API responses.
Each serializer follows the Single Responsibility Principle.
"""

from rest_framework import serializers


class HealthCheckSerializer(serializers.Serializer):
    """Serializer for the health check response."""
    
    status = serializers.CharField(
        help_text="Service health status. 'healthy' means everything is working."
    )
    message = serializers.CharField(
        help_text="Human-readable status message."
    )
    version = serializers.CharField(
        help_text="Current API version."
    )
    service = serializers.CharField(
        help_text="Service identifier."
    )
