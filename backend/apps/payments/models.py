"""
Payment models.

Three tables:
- Payment       : every payment attempt (success or fail)
- Refund        : every refund issued against a payment
- WebhookEvent  : audit log of webhook events for debugging and idempotency
"""
import uuid

from django.db import models


class Payment(models.Model):
    class Status(models.TextChoices):
        CREATED = "created"          # order created, awaiting checkout
        AUTHORIZED = "authorized"    # money authorized but not yet captured
        CAPTURED = "captured"        # money in our gateway account
        FAILED = "failed"            # payment failed
        REFUNDED = "refunded"        # fully refunded
        PARTIALLY_REFUNDED = "partially_refunded"

    class Method(models.TextChoices):
        UPI = "upi"
        CARD = "card"
        NETBANKING = "netbanking"
        WALLET = "wallet"
        EMI = "emi"
        OTHER = "other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(
        "bookings.Booking", on_delete=models.RESTRICT, related_name="payments",
    )

    # Razorpay identifiers
    razorpay_order_id = models.CharField(max_length=64, unique=True)
    razorpay_payment_id = models.CharField(
        max_length=64, unique=True, null=True, blank=True,
    )

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="INR")
    method = models.CharField(
        max_length=20, choices=Method.choices, null=True, blank=True,
    )
    status = models.CharField(
        max_length=25, choices=Status.choices, default=Status.CREATED,
    )

    # Full Razorpay payload for debugging / audits
    raw_response = models.JSONField(null=True, blank=True)

    error_code = models.CharField(max_length=64, null=True, blank=True)
    error_description = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    captured_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payments"
        indexes = [
            models.Index(fields=["booking"], name="idx_payments_booking"),
            models.Index(fields=["status"], name="idx_payments_status"),
            models.Index(fields=["razorpay_order_id"], name="idx_payments_order"),
        ]

    def __str__(self):
        return f"Payment {self.razorpay_order_id} ({self.status})"


class Refund(models.Model):
    class Reason(models.TextChoices):
        GUEST_CANCEL = "guest_cancel"
        HOST_CANCEL = "host_cancel"
        AUTO_EXPIRE = "auto_expire"
        DISPUTE = "dispute"
        OPS_ADJUSTMENT = "ops_adjustment"

    class Status(models.TextChoices):
        INITIATED = "initiated"
        PROCESSED = "processed"
        FAILED = "failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.ForeignKey(
        Payment, on_delete=models.RESTRICT, related_name="refunds",
    )
    razorpay_refund_id = models.CharField(
        max_length=64, unique=True, null=True, blank=True,
    )

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.CharField(max_length=30, choices=Reason.choices)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.INITIATED,
    )
    notes = models.TextField(null=True, blank=True)
    raw_response = models.JSONField(null=True, blank=True)

    initiated_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "refunds"
        indexes = [
            models.Index(fields=["payment"], name="idx_refunds_payment"),
            models.Index(fields=["status"], name="idx_refunds_status"),
        ]

    def __str__(self):
        return f"Refund {self.amount} for {self.payment_id}"


class WebhookEvent(models.Model):
    """
    Append-only log of every webhook received from Razorpay.

    Used for:
    - Audit trail
    - Debugging when reconciliation finds mismatches
    - Replaying missed events if needed
    """
    class Status(models.TextChoices):
        RECEIVED = "received"
        PROCESSED = "processed"
        FAILED = "failed"
        IGNORED = "ignored"   # signature failed, duplicate, etc.

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_id = models.CharField(max_length=128, unique=True, db_index=True)
    event_type = models.CharField(max_length=64, db_index=True)
    payload = models.JSONField()
    signature_valid = models.BooleanField(default=False)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.RECEIVED,
    )
    error_message = models.TextField(null=True, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "webhook_events"

    def __str__(self):
        return f"{self.event_type} ({self.status})"