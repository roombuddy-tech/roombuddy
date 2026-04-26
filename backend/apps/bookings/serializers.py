from rest_framework import serializers


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