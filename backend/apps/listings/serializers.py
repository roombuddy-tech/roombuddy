from rest_framework import serializers


class HostListingItemSerializer(serializers.Serializer):
    listing_id = serializers.UUIDField()
    title = serializers.CharField()
    area_name = serializers.CharField()
    host_price_per_night = serializers.DecimalField(max_digits=10, decimal_places=2)
    status = serializers.CharField()
    average_rating = serializers.DecimalField(max_digits=3, decimal_places=1, allow_null=True)
    total_bookings = serializers.IntegerField()
