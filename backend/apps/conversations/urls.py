from django.urls import path

from apps.conversations.views import (
    ConversationListCreateView,
    MarkReadView,
    MessageListCreateView,
)

urlpatterns = [
    path("", ConversationListCreateView.as_view(), name="conversation-list-create"),
    path("<uuid:conversation_id>/messages/", MessageListCreateView.as_view(), name="conversation-messages"),
    path("<uuid:conversation_id>/read/", MarkReadView.as_view(), name="conversation-read"),
]
