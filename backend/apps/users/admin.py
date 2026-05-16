from django.contrib import admin
from apps.users.models import User, UserProfile, UserSession, OTPCode


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "phone_number", "phone_country_code", "is_profile_complete", "status", "created_at")
    search_fields = ("phone_number", "email")
    list_filter = ("status", "is_profile_complete")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "first_name", "last_name", "gender", "city", "id_status_badge", "id_submitted_at")
    search_fields = ("first_name", "last_name", "user__phone_number")
    list_filter = ("id_verification_status", "gender", "city")
    readonly_fields = ("aadhaar_preview", "selfie_preview", "id_submitted_at", "id_reviewed_at", "created_at", "updated_at")

    fieldsets = (
        ("Personal Info", {
            "fields": ("user", "first_name", "last_name", "gender", "city", "date_of_birth", "profile_photo_url"),
        }),
        ("ID Verification", {
            "fields": (
                "id_verification_status", "id_rejection_reason",
                "aadhaar_preview", "selfie_preview",
                "aadhaar_photo_url", "selfie_photo_url",
                "id_submitted_at", "id_reviewed_at", "id_reviewed_by",
            ),
            "description": "Review uploaded documents. Set status to approved or rejected.",
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

    def id_status_badge(self, obj):
        from django.utils.html import format_html
        colors = {
            "not_submitted": "#888",
            "pending": "#F59E0B",
            "approved": "#10B981",
            "rejected": "#EF4444",
        }
        color = colors.get(obj.id_verification_status, "#888")
        return format_html(
            '<span style="background:{}15;color:{};padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">{}</span>',
            color, color, obj.id_verification_status.upper(),
        )
    id_status_badge.short_description = "ID Status"

    def aadhaar_preview(self, obj):
        from django.utils.html import format_html
        if obj.aadhaar_photo_url:
            from third_party.storage import get_photo_url
            url = get_photo_url(obj.aadhaar_photo_url)
            return format_html('<img src="{}" style="max-width:400px;max-height:300px;border-radius:8px;border:1px solid #ddd;" />', url)
        return "No Aadhaar photo uploaded"
    aadhaar_preview.short_description = "Aadhaar Photo"

    def selfie_preview(self, obj):
        from django.utils.html import format_html
        if obj.selfie_photo_url:
            from third_party.storage import get_photo_url
            url = get_photo_url(obj.selfie_photo_url)
            return format_html('<img src="{}" style="max-width:300px;max-height:300px;border-radius:8px;border:1px solid #ddd;" />', url)
        return "No selfie uploaded"
    selfie_preview.short_description = "Selfie Photo"

    def save_model(self, request, obj, form, change):
        if change and "id_verification_status" in form.changed_data:
            if obj.id_verification_status in ("approved", "rejected"):
                from django.utils import timezone
                obj.id_reviewed_at = timezone.now()
                obj.id_reviewed_by = str(request.user)
        super().save_model(request, obj, form, change)

    actions = ["approve_verifications"]

    @admin.action(description="Approve selected ID verifications")
    def approve_verifications(self, request, queryset):
        from django.utils import timezone
        updated = queryset.filter(id_verification_status="pending").update(
            id_verification_status="approved",
            id_rejection_reason=None,
            id_reviewed_at=timezone.now(),
            id_reviewed_by=str(request.user),
        )
        self.message_user(request, f"{updated} verification(s) approved.")


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "device_name", "expires_at", "revoked_at")
    list_filter = ("revoked_at",)


@admin.register(OTPCode)
class OTPCodeAdmin(admin.ModelAdmin):
    list_display = ("id", "phone", "is_consumed", "attempt_count", "expires_at", "created_at")
    list_filter = ("is_consumed",)