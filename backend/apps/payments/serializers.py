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