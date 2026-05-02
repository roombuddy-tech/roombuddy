import uuid

from django.db import models


class Booking(models.Model):
    class BookingMode(models.TextChoices):
        INSTANT = "instant"
        REQUEST = "request"

    class Status(models.TextChoices):
        PENDING = "pending"
        ACCEPTED = "accepted"
        REJECTED = "rejected"
        CANCELLED_BY_GUEST = "cancelled_by_guest"
        CANCELLED_BY_HOST = "cancelled_by_host"
        ACTIVE = "active"
        COMPLETED = "completed"
        NO_SHOW = "no_show"
        EXPIRED = "expired"

    class CancellationPolicy(models.TextChoices):
        FLEXIBLE = "flexible"
        MODERATE = "moderate"
        STRICT = "strict"

    class PaymentStatus(models.TextChoices):
        UNPAID = "unpaid"
        PAYMENT_PENDING = "payment_pending"
        PAID = "paid"
        REFUND_PENDING = "refund_pending"
        REFUNDED = "refunded"
        PARTIALLY_REFUNDED = "partially_refunded"
        FAILED = "failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking_code = models.CharField(max_length=20, unique=True)
    listing = models.ForeignKey(
        "listings.Listing", on_delete=models.RESTRICT, related_name="bookings",
    )
    guest_user = models.ForeignKey(
        "users.User", on_delete=models.RESTRICT, related_name="bookings_as_guest",
    )
    host_user = models.ForeignKey(
        "users.User", on_delete=models.RESTRICT, related_name="bookings_as_host",
    )

    # Dates
    check_in_date = models.DateField()
    check_out_date = models.DateField()
    number_of_guests = models.SmallIntegerField(default=1)
    guest_purpose = models.CharField(max_length=50, null=True, blank=True)
    booking_mode = models.CharField(max_length=20, choices=BookingMode.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    payment_status = models.CharField(
        max_length=25, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID,
    )
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)


    # Price snapshot
    host_nightly_price = models.DecimalField(max_digits=10, decimal_places=2)
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2)
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2)
    guest_nightly_price = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    security_deposit = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_guest_pays = models.DecimalField(max_digits=10, decimal_places=2)
    total_host_receives = models.DecimalField(max_digits=10, decimal_places=2)
    platform_revenue = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="INR")

    # Host response
    host_responded_at = models.DateTimeField(null=True, blank=True)
    host_response_deadline = models.DateTimeField(null=True, blank=True)

    # Check-in / check-out
    guest_checked_in_at = models.DateTimeField(null=True, blank=True)
    guest_checked_out_at = models.DateTimeField(null=True, blank=True)

    # Cancellation
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(null=True, blank=True)
    cancellation_policy = models.CharField(
        max_length=20, choices=CancellationPolicy.choices, null=True, blank=True,
    )
    refund_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    special_requests = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def nights(self):
        return (self.check_out_date - self.check_in_date).days

    class Meta:
        db_table = "bookings"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(check_out_date__gt=models.F("check_in_date")),
                name="valid_dates",
            ),
        ]
        indexes = [
            models.Index(fields=["guest_user"], name="idx_bookings_guest"),
            models.Index(fields=["host_user"], name="idx_bookings_host"),
            models.Index(fields=["listing"], name="idx_bookings_listing"),
            models.Index(fields=["status"], name="idx_bookings_status"),
        ]

    def __str__(self):
        return self.booking_code


class BookingStatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(
        Booking, on_delete=models.CASCADE, related_name="status_history",
    )
    from_status = models.CharField(max_length=20, null=True, blank=True)
    to_status = models.CharField(max_length=20)
    changed_by_user = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="booking_status_changes",
    )
    reason = models.TextField(null=True, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "booking_status_history"
        verbose_name_plural = "booking status histories"

    def __str__(self):
        return f"{self.booking_id}: {self.from_status} → {self.to_status}"
