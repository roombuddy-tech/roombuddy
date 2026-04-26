from rest_framework import serializers


class ListingItemSerializer(serializers.Serializer):
    listing_id = serializers.UUIDField()
    title = serializers.CharField()
    area_name = serializers.CharField()
    host_price_per_night = serializers.FloatField()
    guest_price_per_night = serializers.FloatField()
    status = serializers.CharField()
    average_rating = serializers.FloatField(allow_null=True)
    review_count = serializers.IntegerField()
    total_bookings = serializers.IntegerField()
    cover_photo_url = serializers.CharField(allow_null=True)


class HostListingsResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    results = ListingItemSerializer(many=True)