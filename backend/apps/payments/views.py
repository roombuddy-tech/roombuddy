"""
Payment endpoints.

POST /api/payments/create-order/    : called by app to create a Razorpay order for a booking
POST /api/payments/verify/          : called by app after Razorpay checkout completes (sync)
POST /api/payments/webhook/         : called by Razorpay servers (async, public)
GET  /api/payments/host/payouts/    : payout history for the authenticated host
"""
import json
import logging

from rest_framework import status as http_status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.bookings.models import Booking
from apps.listings.models import Listing
from apps.payments.models import Payout
from apps.payments.serializers import (
    CreateOrderRequestSerializer,
    CreateOrderResponseSerializer,
    CreateUnlockOrderRequestSerializer,
    CreateUnlockOrderResponseSerializer,
    VerifyPaymentRequestSerializer,
    VerifyPaymentResponseSerializer,
    VerifyUnlockRequestSerializer,
    VerifyUnlockResponseSerializer,
)
from apps.payments.services import (
    create_order_for_booking,
    create_order_for_unlock,
    handle_webhook,
    verify_and_capture,
    verify_and_capture_unlock,
)
from common.authentication import JWTAuthentication
from common.constants import WEBHOOK_DEFAULT_EVENT_TYPE
from common.error_codes import ErrorCode
from common.permissions import IsAuthenticated
from django.db.models import Sum

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


class CreateUnlockOrderView(APIView):
    """Create a Razorpay order to unlock a host's contact on a listing (₹29)."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Payment"],
        request=CreateUnlockOrderRequestSerializer,
        responses={201: CreateUnlockOrderResponseSerializer},
    )
    def post(self, request):
        s = CreateUnlockOrderRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            listing = Listing.objects.select_related("host_user").get(
                id=s.validated_data["listing_id"],
            )
        except Listing.DoesNotExist:
            return Response(
                {"error": "Listing not found", "code": ErrorCode.NOT_FOUND},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        result = create_order_for_unlock(request.user, listing)
        return Response(result, status=http_status.HTTP_201_CREATED)


class VerifyUnlockView(APIView):
    """Verify the unlock payment signature and return the host's phone number."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Payment"],
        request=VerifyUnlockRequestSerializer,
        responses={200: VerifyUnlockResponseSerializer},
    )
    def post(self, request):
        s = VerifyUnlockRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        result = verify_and_capture_unlock(
            s.validated_data["razorpay_order_id"],
            s.validated_data["razorpay_payment_id"],
            s.validated_data["razorpay_signature"],
        )
        return Response(result)


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


class HostPayoutsView(APIView):
    """Returns payout history for the authenticated host."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Payment"])
    def get(self, request):
        payouts = Payout.objects.filter(
            host_user=request.user,
        ).prefetch_related("bookings", "payout_account").order_by("-initiated_at")

        results = []
        for p in payouts:
            # Get payout account details
            account_info = {}
            if p.payout_account:
                if p.payout_account.account_type == "bank":
                    account_info = {
                        "bank_name": p.payout_account.bank_name,
                        "account_last4": p.payout_account.account_number[-4:] if p.payout_account.account_number else None,
                    }
                else:
                    account_info = {
                        "bank_name": "UPI",
                        "account_last4": p.payout_account.upi_id,
                    }

            # Get booking details
            booking_details = [
                {
                    "booking_code": b.booking_code,
                    "guest_name": _get_guest_name(b),
                    "check_in": str(b.check_in_date),
                    "check_out": str(b.check_out_date),
                    "nights": b.nights,
                    "host_receives": float(b.total_host_receives),
                }
                for b in p.bookings.all().select_related("guest_user")
            ]

            results.append({
                "id": str(p.id),
                "amount": float(p.amount),
                "currency": p.currency,
                "status": p.status,
                "method": p.method,
                "transfer_reference": p.transfer_reference,
                "period_start": str(p.period_start) if p.period_start else None,
                "period_end": str(p.period_end) if p.period_end else None,
                "notes": p.notes,
                "initiated_at": p.initiated_at.isoformat(),
                "completed_at": p.completed_at.isoformat() if p.completed_at else None,
                "bookings": booking_details,
                "booking_count": len(booking_details),
                **account_info,
            })

        # Summary
        total_paid = Payout.objects.filter(
            host_user=request.user,
            status=Payout.Status.COMPLETED,
        ).aggregate(total=Sum("amount"))["total"] or 0

        return Response({
            "total_paid_out": float(total_paid),
            "payout_count": len(results),
            "payouts": results,
        })


def _get_guest_name(booking):
    try:
        profile = booking.guest_user.profile
        return f"{profile.first_name} {profile.last_name}".strip() or "Guest"
    except Exception:
        logger.exception("_get_guest_name failed")
        return "Guest"