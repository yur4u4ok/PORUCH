import logging

from django.db import IntegrityError, transaction
from django.db.models import Count, Prefetch, Q, QuerySet
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.conversations import presence, realtime
from apps.conversations.models import Conversation, ConversationParticipant, Message
from apps.moderation.selectors import is_blocked_between
from apps.users.models import User
from common import analytics
from common.exceptions import Forbidden, InvalidState, NotFound

logger = logging.getLogger(__name__)


def _serialize(message: Message) -> dict:
    from apps.conversations.serializers import MessageSerializer

    return dict(MessageSerializer(message).data)


def get_or_create_for_help_request(help_request, helper: User) -> Conversation:
    conversation, created = Conversation.objects.get_or_create(help_request=help_request, helper=helper)
    if created:
        ConversationParticipant.objects.bulk_create(
            [
                ConversationParticipant(conversation=conversation, user_id=help_request.author_id),
                ConversationParticipant(conversation=conversation, user=helper),
            ]
        )
    elif conversation.closed_at is not None:
        conversation.closed_at = None
        conversation.save(update_fields=["closed_at"])
    return conversation


def close_conversations(help_request, helper: User | None = None) -> None:
    qs = Conversation.objects.filter(help_request=help_request, closed_at__isnull=True)
    if helper is not None:
        qs = qs.filter(helper=helper)
    qs.update(closed_at=timezone.now())


def post_system_message(conversation: Conversation, text: str) -> Message:
    message = Message.objects.create(
        conversation=conversation, sender=None, text=text, message_type=Message.Type.SYSTEM
    )
    Conversation.objects.filter(pk=conversation.pk).update(last_message_at=message.created_at)
    realtime.broadcast(conversation.id, "message.created", _serialize(message))
    return message


def conversations_for(user: User) -> QuerySet[Conversation]:
    return (
        Conversation.objects.filter(participants__user=user)
        .select_related("help_request")
        .prefetch_related(
            Prefetch(
                "participants",
                queryset=ConversationParticipant.objects.select_related("user__profile__avatar"),
            ),
        )
        .annotate(
            unread_count=Count(
                "messages",
                filter=Q(messages__read_at__isnull=True)
                & Q(messages__sender__isnull=False)
                & ~Q(messages__sender=user),
                distinct=True,
            )
        )
        .order_by("-last_message_at", "-created_at")
    )


def attach_last_messages(conversations: list[Conversation]) -> None:
    """One query (DISTINCT ON) for the latest message of each conversation."""
    ids = [c.id for c in conversations]
    latest = (
        Message.objects.filter(conversation_id__in=ids)
        .select_related("attachment")
        .order_by("conversation_id", "-created_at")
        .distinct("conversation_id")
    )
    by_conversation = {m.conversation_id: m for m in latest}
    for conversation in conversations:
        message = by_conversation.get(conversation.id)
        conversation.last_messages = [message] if message else []  # type: ignore[attr-defined]


def get_conversation_for(user: User, conversation_id) -> Conversation:
    conversation = (
        Conversation.objects.select_related("help_request")
        .prefetch_related(
            Prefetch("participants", queryset=ConversationParticipant.objects.select_related("user__profile__avatar"))
        )
        .filter(id=conversation_id, participants__user=user)
        .first()
    )
    if conversation is None:
        raise NotFound()
    return conversation


def _other_participant_id(conversation: Conversation, user: User):
    for participant in conversation.participants.all():
        if participant.user_id != user.pk:
            return participant.user_id
    return None


@transaction.atomic
def send_message(
    user: User, conversation_id, *, text: str = "", attachment_id=None, client_id=None
) -> tuple[Message, bool]:
    """Returns (message, created). Idempotent on (sender, client_id)."""
    conversation = get_conversation_for(user, conversation_id)
    if client_id:
        existing = Message.objects.filter(sender=user, client_id=client_id).select_related("attachment").first()
        if existing:
            return existing, False
    if not conversation.is_open:
        raise InvalidState(_("Розмову закрито."), code="CONVERSATION_CLOSED")
    other_id = _other_participant_id(conversation, user)
    other = User.objects.filter(pk=other_id).first()
    if other is None or not other.is_active:
        raise InvalidState(_("Користувач недоступний."), code="USER_UNAVAILABLE")
    if is_blocked_between(user, other):
        raise Forbidden(_("Ви не можете писати цьому користувачу."), code="BLOCKED")

    attachment = None
    if attachment_id:
        from apps.media.services.media import get_ready_media_for_owner

        attachment = get_ready_media_for_owner(user, attachment_id, kind="CHAT")
    try:
        with transaction.atomic():
            message = Message.objects.create(
                conversation=conversation,
                sender=user,
                text=(text or "").strip(),
                message_type=Message.Type.IMAGE if attachment else Message.Type.TEXT,
                attachment=attachment,
                client_id=client_id,
            )
    except IntegrityError:
        return Message.objects.select_related("attachment").get(sender=user, client_id=client_id), False
    Conversation.objects.filter(pk=conversation.pk).update(last_message_at=message.created_at)
    realtime.broadcast(conversation.id, "message.created", _serialize(message))

    if not presence.is_online(conversation.id, other.pk):
        from apps.notifications.models import NotificationType
        from apps.notifications.services.notify import notify

        name = user.profile.display_name if user.profile.show_name else _("Сусід")
        notify(
            other,
            NotificationType.NEW_MESSAGE,
            title=_("💬 Нове повідомлення"),
            body=_("{name} надіслав(ла) вам повідомлення").format(name=name),
            url=f"/chats/{conversation.id}",
            data={"conversation_id": str(conversation.id)},
        )
    analytics.track(user_id=user.id, event="message_sent", properties={"type": message.message_type})
    return message, True


@transaction.atomic
def mark_read(user: User, conversation_id, up_to=None) -> int:
    conversation = get_conversation_for(user, conversation_id)
    now = timezone.now()
    qs = Message.objects.filter(conversation=conversation, read_at__isnull=True, sender__isnull=False).exclude(
        sender=user
    )
    if up_to:
        qs = qs.filter(created_at__lte=up_to)
    ids = [str(i) for i in qs.values_list("id", flat=True)]
    if ids:
        Message.objects.filter(id__in=ids).update(read_at=now)
        realtime.broadcast(
            conversation.id, "message.read", {"reader_id": str(user.pk), "message_ids": ids, "read_at": now.isoformat()}
        )
    ConversationParticipant.objects.filter(conversation=conversation, user=user).update(last_read_at=now)
    return len(ids)


def can_access(user: User, conversation_id) -> bool:
    return ConversationParticipant.objects.filter(conversation_id=conversation_id, user=user).exists()
