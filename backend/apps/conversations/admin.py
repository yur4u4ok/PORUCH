from django.contrib import admin

from apps.conversations.models import Conversation, ConversationParticipant, Message


class ParticipantInline(admin.TabularInline):
    model = ConversationParticipant
    extra = 0
    raw_id_fields = ["user"]
    readonly_fields = ["user", "last_read_at", "joined_at"]


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ["id", "help_request", "created_at", "last_message_at", "closed_at"]
    raw_id_fields = ["help_request", "helper"]
    inlines = [ParticipantInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    """Moderation/debug access only: no list search over private text, read-only."""

    list_display = ["id", "conversation", "sender", "message_type", "created_at"]
    list_filter = ["message_type"]
    raw_id_fields = ["conversation", "sender", "attachment"]
    readonly_fields = [
        "conversation",
        "sender",
        "text",
        "message_type",
        "attachment",
        "client_id",
        "created_at",
        "read_at",
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser or request.user.has_perm("conversations.view_message")
