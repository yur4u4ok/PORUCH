from rest_framework import serializers

from apps.conversations.models import Conversation, Message
from apps.media.serializers import MediaSerializer
from apps.users.serializers import PublicUserSerializer


class ReplyPreviewSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    sender_id = serializers.UUIDField(allow_null=True)
    text = serializers.CharField()
    message_type = serializers.CharField()


class MessageSerializer(serializers.ModelSerializer):
    conversation_id = serializers.UUIDField(read_only=True)
    sender_id = serializers.UUIDField(read_only=True, allow_null=True)
    attachment = MediaSerializer(read_only=True, allow_null=True)
    reply_to = ReplyPreviewSerializer(read_only=True, allow_null=True)
    reactions = serializers.SerializerMethodField()

    def get_reactions(self, message) -> list[dict]:
        """[{emoji, user_ids}] — the client marks its own from user_ids."""
        groups: dict[str, list[str]] = {}
        for reaction in message.reactions.all():
            groups.setdefault(reaction.emoji, []).append(str(reaction.user_id))
        return [{"emoji": emoji, "user_ids": ids} for emoji, ids in groups.items()]

    class Meta:
        model = Message
        fields = [
            "id",
            "conversation_id",
            "sender_id",
            "text",
            "message_type",
            "attachment",
            "reply_to",
            "reactions",
            "client_id",
            "created_at",
            "read_at",
        ]


class MessageCreateSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=3000, required=False, allow_blank=True, trim_whitespace=True)
    attachment_id = serializers.UUIDField(required=False, allow_null=True)
    client_id = serializers.UUIDField(required=False, allow_null=True)
    reply_to_id = serializers.UUIDField(required=False, allow_null=True)

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
    other_online = serializers.SerializerMethodField()
    other_last_seen = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "help_request",
            "other_participant",
            "last_message",
            "unread_count",
            "is_open",
            "other_online",
            "other_last_seen",
            "created_at",
            "last_message_at",
        ]

    def get_other_participant(self, conversation) -> dict | None:
        viewer = self.context["request"].user
        for participant in conversation.participants.all():
            if participant.user_id != viewer.pk:
                return PublicUserSerializer(participant.user).data
        return None

    def get_other_online(self, conversation) -> bool:
        from common import presence

        viewer = self.context["request"].user
        return any(presence.is_online(p.user_id) for p in conversation.participants.all() if p.user_id != viewer.pk)

    def get_other_last_seen(self, conversation):
        viewer = self.context["request"].user
        for p in conversation.participants.all():
            if p.user_id != viewer.pk and p.user.last_seen_at:
                return p.user.last_seen_at.isoformat()
        return None

    def get_last_message(self, conversation) -> dict | None:
        last = getattr(conversation, "last_messages", None)
        message = last[0] if last else None
        return MessageSerializer(message).data if message else None


class ReactionSerializer(serializers.Serializer):
    emoji = serializers.ChoiceField(choices=["👍", "❤️", "😂", "😮", "🙏", "👌"])


class ReadSerializer(serializers.Serializer):
    up_to = serializers.DateTimeField(required=False)
