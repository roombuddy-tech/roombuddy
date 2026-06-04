from rest_framework import serializers

from apps.conversations.services import MESSAGE_MAX_LENGTH


class StartConversationRequestSerializer(serializers.Serializer):
    booking_id = serializers.UUIDField()


class SendMessageRequestSerializer(serializers.Serializer):
    body = serializers.CharField(
        max_length=MESSAGE_MAX_LENGTH, trim_whitespace=True, allow_blank=False,
    )


class MessageSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    body = serializers.CharField()
    sender_id = serializers.UUIDField()
    is_mine = serializers.BooleanField()
    created_at = serializers.DateTimeField()


class ConversationSerializer(serializers.Serializer):
    conversation_id = serializers.UUIDField()
    booking_id = serializers.UUIDField()
    booking_code = serializers.CharField()
    listing_title = serializers.CharField(allow_null=True)
    counterpart_name = serializers.CharField()
    counterpart_initials = serializers.CharField()
    last_message = serializers.CharField(allow_null=True)
    last_message_at = serializers.DateTimeField(allow_null=True)
    unread_count = serializers.IntegerField()


class ConversationListResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    results = ConversationSerializer(many=True)


class MessageListResponseSerializer(serializers.Serializer):
    conversation_id = serializers.UUIDField()
    count = serializers.IntegerField()
    results = MessageSerializer(many=True)