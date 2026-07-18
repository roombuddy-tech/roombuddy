from rest_framework import status as http_status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.bookings.models import Booking
from apps.conversations.models import Conversation
from apps.conversations.serializers import (
    ConversationListResponseSerializer,
    ConversationSerializer,
    MessageListResponseSerializer,
    MessageSerializer,
    SendMessageRequestSerializer,
    StartConversationRequestSerializer,
)
from apps.conversations.services import (
    create_message,
    get_messages,
    get_or_create_conversation,
    is_participant,
    list_conversations,
    mark_read,
    serialize_conversation,
    serialize_message,
)
from common.authentication import JWTAuthentication
from common.error_codes import ErrorCode
from common.permissions import IsAuthenticated
import logging

logger = logging.getLogger(__name__)


class ConversationListCreateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Chat"], responses={200: ConversationListResponseSerializer})
    def get(self, request):
        results = list_conversations(request.user)
        return Response({"count": len(results), "results": results})

    @extend_schema(
        tags=["Chat"],
        request=StartConversationRequestSerializer,
        responses={200: ConversationSerializer},
    )
    def post(self, request):
        s = StartConversationRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        # ── Pre-booking inquiry: guest messages a listing's host ──────────
        if s.validated_data.get("listing_id"):
            from apps.listings.models import Listing
            from apps.conversations.services import get_or_create_inquiry_conversation
            try:
                listing = Listing.objects.select_related("host_user").get(
                    id=s.validated_data["listing_id"]
                )
            except Listing.DoesNotExist:
                return Response(
                    {"error": "Listing not found", "code": ErrorCode.NOT_FOUND},
                    status=http_status.HTTP_404_NOT_FOUND,
                )
            if request.user.id == listing.host_user_id:
                return Response(
                    {"error": "You can't message your own listing", "code": ErrorCode.FORBIDDEN},
                    status=http_status.HTTP_403_FORBIDDEN,
                )
            conversation = get_or_create_inquiry_conversation(request.user, listing)
            return Response(serialize_conversation(conversation, request.user))

        # ── Post-booking chat ─────────────────────────────────────────────
        try:
            booking = (
                Booking.objects.select_related("guest_user", "host_user", "listing")
                .get(id=s.validated_data["booking_id"])
            )
        except Booking.DoesNotExist:
            return Response(
                {"error": "Booking not found", "code": ErrorCode.NOT_FOUND},
                status=http_status.HTTP_404_NOT_FOUND,
            )
        if request.user.id not in (booking.guest_user_id, booking.host_user_id):
            return Response(
                {"error": "Not allowed", "code": ErrorCode.FORBIDDEN},
                status=http_status.HTTP_403_FORBIDDEN,
            )
        conversation = get_or_create_conversation(booking)
        conversation.booking = booking
        return Response(serialize_conversation(conversation, request.user))


class MessageListCreateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _resolve(self, request, conversation_id):
        try:
            conversation = (
                Conversation.objects.select_related("guest_user", "host_user")
                .get(id=conversation_id)
            )
        except Conversation.DoesNotExist:
            return None, Response(
                {"error": "Conversation not found", "code": ErrorCode.NOT_FOUND},
                status=http_status.HTTP_404_NOT_FOUND,
            )
        if not is_participant(conversation, request.user):
            return None, Response(
                {"error": "Not allowed", "code": ErrorCode.FORBIDDEN},
                status=http_status.HTTP_403_FORBIDDEN,
            )
        return conversation, None

    @extend_schema(
        tags=["Chat"],
        parameters=[OpenApiParameter(
            name="after", required=False, type=str,
            description="ISO timestamp; returns only messages created after it.",
        )],
        responses={200: MessageListResponseSerializer},
    )
    def get(self, request, conversation_id):
        conversation, error = self._resolve(request, conversation_id)
        if error:
            return error
        after = request.query_params.get("after")
        results = get_messages(conversation, request.user, after=after)
        return Response({
            "conversation_id": str(conversation.id),
            "count": len(results),
            "results": results,
        })

    @extend_schema(
        tags=["Chat"],
        request=SendMessageRequestSerializer,
        responses={201: MessageSerializer},
    )
    def post(self, request, conversation_id):
        conversation, error = self._resolve(request, conversation_id)
        if error:
            return error
        s = SendMessageRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        message = create_message(conversation, request.user, s.validated_data["body"])
        return Response(
            serialize_message(message, request.user),
            status=http_status.HTTP_201_CREATED,
        )


class MarkReadView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Chat"], request=None, responses={200: dict})
    def post(self, request, conversation_id):
        try:
            conversation = Conversation.objects.get(id=conversation_id)
        except Conversation.DoesNotExist:
            return Response(
                {"error": "Conversation not found", "code": ErrorCode.NOT_FOUND},
                status=http_status.HTTP_404_NOT_FOUND,
            )
        if not is_participant(conversation, request.user):
            return Response(
                {"error": "Not allowed", "code": ErrorCode.FORBIDDEN},
                status=http_status.HTTP_403_FORBIDDEN,
            )
        mark_read(conversation, request.user)
        return Response({"status": "ok"})
