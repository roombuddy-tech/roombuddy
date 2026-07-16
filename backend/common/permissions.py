from rest_framework.permissions import BasePermission
import logging

logger = logging.getLogger(__name__)


class IsAuthenticated(BasePermission):
    """User must be authenticated via JWT."""

    def has_permission(self, request, view):
        return request.user is not None and hasattr(request.user, "id")


class IsProfileComplete(BasePermission):
    """User must have completed their profile."""

    message = "Please complete your profile first."

    def has_permission(self, request, view):
        return getattr(request.user, "is_profile_complete", False)


class IsAdminUser(BasePermission):
    """User must be authenticated and have is_staff=True."""

    message = "Admin access required."

    def has_permission(self, request, view):
        return (
            request.user is not None
            and hasattr(request.user, "id")
            and getattr(request.user, "is_staff", False)
        )