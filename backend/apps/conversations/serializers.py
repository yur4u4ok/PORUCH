from rest_framework import serializers

from apps.conversations.models import Conversation, Message
from apps.media.serializers import MediaSerializer
from apps.users.serializers import PublicUserSerializer


class MessageSerializer(serializers.ModelSerializer):
    conversation_id = serializers.UUIDField(read_only=True)
    sender_id = serializers.UUIDField(read_only=True, allow_null=True)
    attachment = MediaSerializer(read_only=True, allow_null=True)

    class Meta:
        model = Message
        fields = [
            "id",
            "conversation_id",
            "sender_id",
            "text",
            "message_type",
            "attachment",
            "client_id",
            "created_at",
            "read_at",
        ]


class MessageCreateSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=3000, required=False, allow_blank=True, trim_whitespace=True)
    attachment_id = serializers.UUIDField(required=False, allow_null=True)
    client_id = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        if not attrs.get("text") and not attrs.get("attachment_id"):
            raise serializers.ValidationError({"text": ["Повідомлення не може бути порожнім."]})
        return attrs


class ConversationHelpRequestSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    category = serializers.CharField()
    status = serializers.CharField()
    author_id = serializers.UUIDField()


class ConversationSerializer(serializers.ModelSerializer):
    help_request = ConversationHelpRequestSerializer(read_only=True)
    other_participant = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.IntegerField(read_only=True, default=0)
    is_open = serializers.BooleanField(read_only=True)

    class Meta:
        model = Conversation
        fields = [
            "id",
            "help_request",
            "other_participant",
            "last_message",
            "unread_count",
            "is_open",
            "created_at",
            "last_message_at",
        ]

    def get_other_participant(self, conversation) -> dict | None:
        viewer = self.context["request"].user
        for participant in conversation.participants.all():
            if participant.user_id != viewer.pk:
                return PublicUserSerializer(participant.user).data
        return None

    def get_last_message(self, conversation) -> dict | None:
        last = getattr(conversation, "last_messages", None)
        message = last[0] if last else None
        return MessageSerializer(message).data if message else None


class ReadSerializer(serializers.Serializer):
    up_to = serializers.DateTimeField(required=False)
