import uuid

from django.db import models


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.OneToOneField(
        "bookings.Booking", on_delete=models.CASCADE, related_name="conversation",
    )
    guest_user = models.ForeignKey(
        "users.User", on_delete=models.RESTRICT, related_name="conversations_as_guest",
    )
    host_user = models.ForeignKey(
        "users.User", on_delete=models.RESTRICT, related_name="conversations_as_host",
    )
    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)
    guest_last_read_at = models.DateTimeField(null=True, blank=True)
    host_last_read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "conversations"
        indexes = [
            models.Index(fields=["guest_user", "-last_message_at"], name="idx_conv_guest_lastmsg"),
            models.Index(fields=["host_user", "-last_message_at"], name="idx_conv_host_lastmsg"),
        ]

    def __str__(self):
        return f"Conversation for booking {self.booking_id}"


class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages",
    )
    sender_user = models.ForeignKey(
        "users.User", on_delete=models.RESTRICT, related_name="sent_messages",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "messages"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["conversation", "created_at"], name="idx_msg_conv_created"),
        ]

    def __str__(self):
        return f"Message {self.id} from {self.sender_user_id}"