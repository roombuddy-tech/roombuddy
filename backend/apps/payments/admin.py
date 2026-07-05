from django.contrib import admin
from django.db.models import Sum
from django.utils import timezone
from django.utils.html import format_html

from apps.payments.models import ContactUnlock, Payment, Payout, Refund, WebhookEvent
import logging

logger = logging.getLogger(__name__)


def _user_label(user):
    if not user:
        return "—"
    try:
        name = f"{user.profile.first_name} {user.profile.last_name}".strip()
    except Exception:
        name = ""
    phone = f"{user.phone_country_code or ''}{user.phone_number or ''}".strip()
    return (name + (f" ({phone})" if phone else "")) or phone or str(user.id)


@admin.register(ContactUnlock)
class ContactUnlockAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "guest_display",
        "host_display",
        "listing_title",
        "amount",
        "status",
        "unlocked_at",
    )
    list_filter = ("status", "created_at")
    search_fields = (
        "razorpay_order_id",
        "razorpay_payment_id",
        "guest_user__phone_number",
        "guest_user__profile__first_name",
        "host_user__phone_number",
        "host_user__profile__first_name",
        "listing__title",
    )
    readonly_fields = ("created_at", "updated_at", "unlocked_at")
    raw_id_fields = ("guest_user", "host_user", "listing")
    date_hierarchy = "created_at"

    @admin.display(description="Guest")
    def guest_display(self, obj):
        return _user_label(obj.guest_user)

    @admin.display(description="Host")
    def host_display(self, obj):
        return _user_label(obj.host_user)

    @admin.display(description="Listing")
    def listing_title(self, obj):
        return obj.listing.title if obj.listing_id else "—"


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("razorpay_order_id", "booking", "amount", "status", "method", "created_at")
    list_filter = ("status", "method")
    search_fields = ("razorpay_order_id", "razorpay_payment_id", "booking__booking_code")
    readonly_fields = ("created_at", "updated_at", "captured_at", "failed_at")


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = ("razorpay_refund_id", "payment", "amount", "reason", "status", "initiated_at")
    list_filter = ("status", "reason")
    search_fields = ("razorpay_refund_id", "payment__booking__booking_code")
    readonly_fields = ("initiated_at", "completed_at")


@admin.register(WebhookEvent)
class WebhookEventAdmin(admin.ModelAdmin):
    list_display = ("event_id", "event_type", "status", "signature_valid", "received_at")
    list_filter = ("event_type", "status", "signature_valid")
    search_fields = ("event_id",)
    readonly_fields = ("received_at", "processed_at")


@admin.register(Payout)
class PayoutAdmin(admin.ModelAdmin):
    list_display = (
        "payout_id_short",
        "host_name",
        "amount_display",
        "status_badge",
        "method",
        "transfer_reference",
        "booking_count",
        "initiated_at",
    )
    list_filter = ("status", "method", "initiated_at")
    search_fields = (
        "host_user__phone_number",
        "host_user__profile__first_name",
        "transfer_reference",
    )
    readonly_fields = ("initiated_at",)
    raw_id_fields = ("host_user", "payout_account")
    filter_horizontal = ("bookings",)
    date_hierarchy = "initiated_at"

    fieldsets = (
        ("Host & Amount", {
            "fields": ("host_user", "payout_account", "amount", "currency"),
        }),
        ("Transfer Details", {
            "fields": ("status", "method", "transfer_reference"),
        }),
        ("Period", {
            "fields": ("period_start", "period_end"),
            "description": "Optional: the booking period this payout covers.",
        }),
        ("Bookings Included", {
            "fields": ("bookings",),
            "description": "Select the bookings covered by this payout. "
                           "Use Ctrl+Click (Cmd+Click on Mac) to select multiple.",
        }),
        ("Notes & Timestamps", {
            "fields": ("notes", "initiated_at", "completed_at", "failed_at"),
        }),
    )

    def payout_id_short(self, obj):
        return str(obj.id)[:8]
    payout_id_short.short_description = "ID"

    def host_name(self, obj):
        try:
            p = obj.host_user.profile
            return f"{p.first_name} {p.last_name} ({obj.host_user.phone_number})"
        except Exception:
            logger.exception("PayoutAdmin.host_name failed")
            return obj.host_user.phone_number
    host_name.short_description = "Host"

    def amount_display(self, obj):
        return f"₹{obj.amount:,.2f}"
    amount_display.short_description = "Amount"

    def status_badge(self, obj):
        colors = {
            "completed": "#10B981",
            "pending": "#F59E0B",
            "processing": "#3B82F6",
            "failed": "#EF4444",
        }
        color = colors.get(obj.status, "#888")
        return format_html(
            '<span style="background:{}15;color:{};padding:3px 10px;'
            'border-radius:12px;font-size:11px;font-weight:600;">{}</span>',
            color, color, obj.status.upper(),
        )
    status_badge.short_description = "Status"

    def booking_count(self, obj):
        return obj.bookings.count()
    booking_count.short_description = "Bookings"

    def save_model(self, request, obj, form, change):
        """Auto-set completed_at when status changes to completed."""
        if obj.status == Payout.Status.COMPLETED and not obj.completed_at:
            obj.completed_at = timezone.now()
        if obj.status == Payout.Status.FAILED and not obj.failed_at:
            obj.failed_at = timezone.now()
        super().save_model(request, obj, form, change)

    actions = ["mark_completed", "mark_failed"]

    @admin.action(description="Mark selected payouts as Completed")
    def mark_completed(self, request, queryset):
        updated = queryset.filter(status=Payout.Status.PENDING).update(
            status=Payout.Status.COMPLETED,
            completed_at=timezone.now(),
        )
        self.message_user(request, f"{updated} payout(s) marked as completed.")

    @admin.action(description="Mark selected payouts as Failed")
    def mark_failed(self, request, queryset):
        updated = queryset.filter(status__in=[Payout.Status.PENDING, Payout.Status.PROCESSING]).update(
            status=Payout.Status.FAILED,
            failed_at=timezone.now(),
        )
        self.message_user(request, f"{updated} payout(s) marked as failed.")