"""
Core app URL configuration.

Contains health check and system-level endpoints.
"""

from django.urls import path
from core.api.views import HealthCheckView

urlpatterns = [
    path("hello/", HealthCheckView.as_view(), name="health-check"),
]
