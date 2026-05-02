from django.contrib import admin

from apps.payments.models import Payment, Refund, WebhookEvent


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