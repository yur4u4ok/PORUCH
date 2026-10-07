from django.conf import settings
from django.core.validators import MaxLengthValidator
from django.db import models
from django.db.models import Q

from common.models import UUIDModel


class Conversation(UUIDModel):
    """Chat between the request author and the selected helper."""

    help_request = models.ForeignKey(
        "help_requests.HelpRequest", on_delete=models.CASCADE, related_name="conversations"
    )
    helper = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_message_at", "-created_at"]
        verbose_name = "розмова"
        verbose_name_plural = "розмови"
        constraints = [
            models.UniqueConstraint(fields=["help_request", "helper"], name="unique_conversation_per_helper"),
        ]

    def __str__(self) -> str:
        return f"Conversation {self.id}"

    @property
    def is_open(self) -> bool:
        return self.closed_at is None


class ConversationParticipant(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="participants")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversation_links")
    last_read_at = models.DateTimeField(null=True, blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["conversation", "user"], name="unique_conversation_participant"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} in {self.conversation_id}"


class Message(UUIDModel):
    class Type(models.TextChoices):
        TEXT = "TEXT", "Текст"
        IMAGE = "IMAGE", "Зображення"
        SYSTEM = "SYSTEM", "Системне"

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages", db_index=True)
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="messages"
    )
    text = models.TextField(max_length=3000, blank=True, validators=[MaxLengthValidator(3000)])
    message_type = models.CharField(max_length=10, choices=Type.choices, default=Type.TEXT)
    attachment = models.ForeignKey("media.Media", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    # The message this one answers (shown as a quote above it).
    reply_to = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    # Client generated id for optimistic UI + idempotent retries.
    client_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "повідомлення"
        verbose_name_plural = "повідомлення"
        indexes = [models.Index(fields=["conversation", "-created_at"], name="msg_conv_created_idx")]
        constraints = [
            models.UniqueConstraint(
                fields=["sender", "client_id"], condition=Q(client_id__isnull=False), name="unique_message_client_id"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.message_type} {self.id}"


class MessageReaction(models.Model):
    """One emoji per person per message; picking another replaces it, picking the same removes it."""

    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    emoji = models.CharField(max_length=16)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["message", "user"], name="one_reaction_per_user")]

    def __str__(self) -> str:
        return f"{self.emoji} on {self.message_id}"
