from django.contrib import admin
from apps.users.models import User, UserProfile, UserSession, OTPCode


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "phone_number", "phone_country_code", "is_profile_complete", "status", "created_at")
    search_fields = ("phone_number", "email")
    list_filter = ("status", "is_profile_complete")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "first_name", "last_name", "gender", "city")
    search_fields = ("first_name", "last_name")


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "device_name", "expires_at", "revoked_at")
    list_filter = ("revoked_at",)


@admin.register(OTPCode)
class OTPCodeAdmin(admin.ModelAdmin):
    list_display = ("id", "phone", "is_consumed", "attempt_count", "expires_at", "created_at")
    list_filter = ("is_consumed",)