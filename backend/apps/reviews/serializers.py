from rest_framework import serializers


class SubmitReviewSerializer(serializers.Serializer):
    overall_rating = serializers.IntegerField(min_value=1, max_value=5)
    cleanliness_rating = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)
    accuracy_rating = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)
    communication_rating = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)
    location_rating = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)
    value_rating = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)
    food_rating = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    body = serializers.CharField(max_length=2000, required=False, allow_blank=True)
