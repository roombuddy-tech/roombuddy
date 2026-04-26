from rest_framework.permissions import BasePermission


class IsAuthenticated(BasePermission):
    """User must be authenticated via JWT."""

    def has_permission(self, request, view):
        return request.user is not None and hasattr(request.user, "id")


class IsProfileComplete(BasePermission):
    """User must have completed their profile."""

    message = "Please complete your profile first."

    def has_permission(self, request, view):
        return getattr(request.user, "is_profile_complete", False)