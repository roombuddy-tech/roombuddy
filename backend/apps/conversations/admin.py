from django.contrib import admin

from apps.conversations.models import Conversation, Message
import logging

logger = logging.getLogger(__name__)


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "booking", "guest_user", "host_user", "last_message_at")
    search_fields = ("id", "booking__booking_code")
    raw_id_fields = ("booking", "guest_user", "host_user")


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "sender_user", "created_at")
    search_fields = ("id", "conversation__id", "body")
    raw_id_fields = ("conversation", "sender_user")
