from rest_framework import serializers


# ─── Response serializers ──────────────────────────────────────────────────────

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


# ─── Input serializers ─────────────────────────────────────────────────────────

class FlatmateInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    age = serializers.IntegerField(required=False, allow_null=True)
    occupation = serializers.CharField(required=False, allow_blank=True, default="")
    hobbies = serializers.CharField(required=False, allow_blank=True, default="")


class PropertyInputSerializer(serializers.Serializer):
    apartment_type = serializers.ChoiceField(choices=["1bhk", "2bhk", "3bhk", "4bhk"])
    floor_number = serializers.IntegerField()
    total_floors = serializers.IntegerField(required=False, allow_null=True)
    apartment_name = serializers.CharField(max_length=255)
    address_line1 = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    city_name = serializers.CharField(max_length=100)
    gender_preference = serializers.ChoiceField(
        choices=["male_only", "female_only", "any"], default="any"
    )


class RoomInputSerializer(serializers.Serializer):
    room_type = serializers.ChoiceField(choices=["private", "shared"])
    bed_type = serializers.ChoiceField(choices=["single", "double", "queen", "king", "mattress"])
    bathroom_type = serializers.ChoiceField(choices=["attached", "shared"])
    room_size_sqft = serializers.IntegerField(required=False, allow_null=True)
    room_features = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )


class HouseRulesInputSerializer(serializers.Serializer):
    no_smoking = serializers.BooleanField(default=False)
    no_loud_music = serializers.BooleanField(default=False)
    no_pets = serializers.BooleanField(default=False)
    no_alcohol = serializers.BooleanField(default=False)
    no_parties = serializers.BooleanField(default=False)
    shoes_off = serializers.BooleanField(default=False)
    kitchen_clean = serializers.BooleanField(default=False)
    lock_door = serializers.BooleanField(default=False)
    custom_rules = serializers.CharField(required=False, allow_blank=True, default="")
    cancellation_policy = serializers.ChoiceField(
        choices=["flexible", "moderate", "strict"], default="moderate"
    )
    check_in_time = serializers.CharField()
    check_out_time = serializers.CharField()


class CreateListingRequestSerializer(serializers.Serializer):
    property = PropertyInputSerializer()
    room = RoomInputSerializer()
    flatmates = FlatmateInputSerializer(many=True, required=False, default=list)
    amenities = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    host_price_per_night = serializers.DecimalField(max_digits=10, decimal_places=2)
    min_nights = serializers.IntegerField(default=1)
    food_kitchen_access = serializers.BooleanField(default=False)
    food_meals_available = serializers.BooleanField(default=False)
    house_rules = HouseRulesInputSerializer()


class CreateListingResponseSerializer(serializers.Serializer):
    listing_id = serializers.UUIDField()
    status = serializers.CharField()
    message = serializers.CharField()
