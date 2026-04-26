from rest_framework import serializers


class HostBookingListSerializer(serializers.Serializer):
    """Response serializer for host bookings list."""
    booking_id = serializers.UUIDField()
    booking_code = serializers.CharField()
    guest_name = serializers.CharField()
    guest_initials = serializers.CharField()
    check_in_date = serializers.DateField()
    check_out_date = serializers.DateField()
    nights = serializers.IntegerField()
    guest_purpose = serializers.CharField(allow_null=True)
    status = serializers.CharField()
    total_guest_pays = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_host_receives = serializers.DecimalField(max_digits=10, decimal_places=2)
