"""
Payment endpoints.

POST /api/payments/create-order/    : called by app to create a Razorpay order for a booking
POST /api/payments/verify/          : called by app after Razorpay checkout completes (sync)
POST /api/payments/webhook/         : called by Razorpay servers (async, public)
"""
import json
import logging

from rest_framework import status as http_status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.bookings.models import Booking
from apps.payments.serializers import (
    CreateOrderRequestSerializer,
    CreateOrderResponseSerializer,
    VerifyPaymentRequestSerializer,
    VerifyPaymentResponseSerializer,
)
from apps.payments.services import (
    create_order_for_booking,
    handle_webhook,
    verify_and_capture,
)
from common.authentication import JWTAuthentication
from common.constants import WEBHOOK_DEFAULT_EVENT_TYPE
from common.error_codes import ErrorCode
from common.permissions import IsAuthenticated

logger = logging.getLogger(__name__)


class CreateOrderView(APIView):
    """Create a Razorpay order for a booking. Returns checkout-ready data for the SDK."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Payment"],
        request=CreateOrderRequestSerializer,
        responses={201: CreateOrderResponseSerializer},
    )
    def post(self, request):
        s = CreateOrderRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            booking = Booking.objects.get(id=s.validated_data["booking_id"])
        except Booking.DoesNotExist:
            return Response(
                {"error": "Booking not found", "code": ErrorCode.NOT_FOUND},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        if booking.guest_user_id != request.user.id:
            return Response(
                {"error": "Not allowed", "code": ErrorCode.FORBIDDEN},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        result = create_order_for_booking(booking)
        return Response(result, status=http_status.HTTP_201_CREATED)


class VerifyPaymentView(APIView):
    """
    Verify the signature returned by the Razorpay checkout SDK.
    Webhooks are the source of truth, but this gives the app immediate feedback.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Payment"],
        request=VerifyPaymentRequestSerializer,
        responses={200: VerifyPaymentResponseSerializer},
    )
    def post(self, request):
        s = VerifyPaymentRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        booking = verify_and_capture(
            s.validated_data["razorpay_order_id"],
            s.validated_data["razorpay_payment_id"],
            s.validated_data["razorpay_signature"],
        )
        return Response({
            "booking_id": str(booking.id),
            "booking_code": booking.booking_code,
            "status": booking.status,
            "payment_status": booking.payment_status,
        })


class RazorpayWebhookView(APIView):
    """
    Public endpoint called by Razorpay servers for async events.

    Authentication is via the X-Razorpay-Signature header (HMAC verified
    against the raw body inside `handle_webhook`), NOT a JWT.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(tags=["Payment"], request=None, responses={200: None})
    def post(self, request):
        signature = request.headers.get("X-Razorpay-Signature", "")
        raw_body = request.body

        try:
            payload = json.loads(raw_body)
        except json.JSONDecodeError:
            logger.warning("Webhook: invalid JSON")
            return Response(
                {"status": "bad_request"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        event_id = payload.get("id") or request.headers.get("X-Razorpay-Event-Id", "")
        event_type = payload.get("event", WEBHOOK_DEFAULT_EVENT_TYPE)

        if not event_id:
            logger.warning("Webhook: missing event id")
            return Response({"status": "ignored"}, status=http_status.HTTP_200_OK)

        handle_webhook(event_type, event_id, payload, raw_body, signature)
        # Always return 200 quickly so Razorpay doesn't keep retrying
        return Response({"status": "ok"}, status=http_status.HTTP_200_OK)
