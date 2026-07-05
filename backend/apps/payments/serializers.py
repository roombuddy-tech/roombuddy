from rest_framework import serializers


class CreateOrderRequestSerializer(serializers.Serializer):
    booking_id = serializers.UUIDField()


class CreateOrderResponseSerializer(serializers.Serializer):
    razorpay_key_id = serializers.CharField()
    order_id = serializers.CharField()
    amount = serializers.IntegerField()
    currency = serializers.CharField()
    booking_code = serializers.CharField()


class VerifyPaymentRequestSerializer(serializers.Serializer):
    razorpay_order_id = serializers.CharField()
    razorpay_payment_id = serializers.CharField()
    razorpay_signature = serializers.CharField()


class VerifyPaymentResponseSerializer(serializers.Serializer):
    booking_id = serializers.UUIDField()
    booking_code = serializers.CharField()
    status = serializers.CharField()
    payment_status = serializers.CharField()


class CreateUnlockOrderRequestSerializer(serializers.Serializer):
    listing_id = serializers.UUIDField()


class CreateUnlockOrderResponseSerializer(serializers.Serializer):
    already_unlocked = serializers.BooleanField()
    razorpay_key_id = serializers.CharField(required=False)
    order_id = serializers.CharField(required=False)
    amount = serializers.IntegerField(required=False)
    currency = serializers.CharField(required=False)


class VerifyUnlockRequestSerializer(serializers.Serializer):
    razorpay_order_id = serializers.CharField()
    razorpay_payment_id = serializers.CharField()
    razorpay_signature = serializers.CharField()


class VerifyUnlockResponseSerializer(serializers.Serializer):
    listing_id = serializers.UUIDField()
    host_name = serializers.CharField()
    host_phone = serializers.CharField(allow_null=True)