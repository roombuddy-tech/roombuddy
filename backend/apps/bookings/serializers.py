from rest_framework import serializers

class CreateBookingRequestSerializer(serializers.Serializer):
    listing_id = serializers.UUIDField()
    check_in_date = serializers.DateField()
    check_out_date = serializers.DateField()
    number_of_guests = serializers.IntegerField(min_value=1, default=1)
    guest_purpose = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    special_requests = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class QuoteRequestSerializer(serializers.Serializer):
    listing_id = serializers.UUIDField()
    check_in_date = serializers.DateField()
    check_out_date = serializers.DateField()


class QuoteResponseSerializer(serializers.Serializer):
    listing_id = serializers.UUIDField()
    nights = serializers.IntegerField()
    host_nightly_price = serializers.FloatField()
    guest_nightly_price = serializers.FloatField()
    subtotal = serializers.FloatField()
    gst_amount = serializers.FloatField()
    platform_fee = serializers.FloatField()
    security_deposit = serializers.FloatField()
    total_guest_pays = serializers.FloatField()
    total_host_receives = serializers.FloatField()
    platform_revenue = serializers.FloatField()
    currency = serializers.CharField()
    booking_mode = serializers.CharField()


class BookingDetailSerializer(serializers.Serializer):
    booking_id = serializers.UUIDField()
    booking_code = serializers.CharField()
    status = serializers.CharField()
    payment_status = serializers.CharField()
    check_in_date = serializers.DateField()
    check_out_date = serializers.DateField()
    nights = serializers.IntegerField()
    total_guest_pays = serializers.FloatField()
    total_host_receives = serializers.FloatField()
    cancellation_policy = serializers.CharField(allow_null=True)


class CancelBookingRequestSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class CancelBookingResponseSerializer(serializers.Serializer):
    booking_id = serializers.UUIDField()
    status = serializers.CharField()
    payment_status = serializers.CharField()
    refund_amount = serializers.FloatField()


class BookingItemSerializer(serializers.Serializer):
    booking_id = serializers.UUIDField()
    booking_code = serializers.CharField()
    guest_name = serializers.CharField()
    guest_initials = serializers.CharField()
    check_in_date = serializers.DateField()
    check_out_date = serializers.DateField()
    nights = serializers.IntegerField()
    guest_purpose = serializers.CharField(allow_null=True)
    status = serializers.CharField()
    total_guest_pays = serializers.FloatField()
    total_host_receives = serializers.FloatField()


class HostBookingsResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    results = BookingItemSerializer(many=True)


class LifetimeEarningsSerializer(serializers.Serializer):
    total_earnings = serializers.FloatField()
    total_bookings = serializers.IntegerField()
    total_nights = serializers.IntegerField()


class MonthlyEarningsSerializer(serializers.Serializer):
    month = serializers.CharField()
    month_iso = serializers.CharField()
    earnings = serializers.FloatField()
    bookings = serializers.IntegerField()


class PayoutSerializer(serializers.Serializer):
    bank_name = serializers.CharField(allow_null=True)
    account_last4 = serializers.CharField(allow_null=True)
    payout_schedule = serializers.CharField(allow_null=True)
    next_payout_amount = serializers.FloatField(allow_null=True)
    next_payout_date = serializers.CharField(allow_null=True)


class HostEarningsResponseSerializer(serializers.Serializer):
    lifetime = LifetimeEarningsSerializer()
    monthly = MonthlyEarningsSerializer(many=True)
    payout = PayoutSerializer()