from django.db import IntegrityError, transaction
from django.utils.translation import gettext as _

from apps.moderation.models import Report, UserBlock
from apps.users.models import User
from common import analytics
from common.exceptions import NotFound, ValidationFailed


@transaction.atomic
def block_user(blocker: User, blocked_id) -> UserBlock:
    if str(blocked_id) == str(blocker.pk):
        raise ValidationFailed(details={"user_id": [_("Не можна заблокувати себе.")]})
    blocked = User.objects.filter(pk=blocked_id).first()
    if blocked is None:
        raise NotFound()
    try:
        with transaction.atomic():
            block, _created = UserBlock.objects.get_or_create(blocker=blocker, blocked=blocked)
    except IntegrityError:
        block = UserBlock.objects.get(blocker=blocker, blocked=blocked)
    # Blocked users must not keep interacting.
    from apps.interactions.services.responses import cancel_pending_between

    cancel_pending_between(blocker, blocked)
    analytics.track(user_id=blocker.id, event="user_blocked")
    return block


def unblock_user(blocker: User, blocked_id) -> None:
    UserBlock.objects.filter(blocker=blocker, blocked_id=blocked_id).delete()


def create_report(
    reporter: User, *, reason: str, description: str = "", target_user_id=None, help_request_id=None, message_id=None
) -> Report:
    from apps.conversations.models import Message
    from apps.help_requests.models import HelpRequest

    if not any([target_user_id, help_request_id, message_id]):
        raise ValidationFailed(details={"non_field_errors": [_("Вкажіть, на що скаржитесь.")]})
    target_user = help_request = message = None
    if target_user_id:
        target_user = User.objects.filter(pk=target_user_id).first()
        if target_user is None:
            raise ValidationFailed(details={"target_user_id": [_("Не знайдено.")]})
    if help_request_id:
        help_request = HelpRequest.objects.filter(pk=help_request_id).first()
        if help_request is None:
            raise ValidationFailed(details={"help_request_id": [_("Не знайдено.")]})
        target_user = target_user or help_request.author
    if message_id:
        # Only participants can report a message they have seen.
        message = Message.objects.filter(pk=message_id, conversation__participants__user=reporter).first()
        if message is None:
            raise ValidationFailed(details={"message_id": [_("Не знайдено.")]})
        target_user = target_user or message.sender
    if target_user and target_user.pk == reporter.pk:
        raise ValidationFailed(details={"target_user_id": [_("Не можна поскаржитися на себе.")]})
    report = Report.objects.create(
        reporter=reporter,
        target_user=target_user,
        help_request=help_request,
        message=message,
        reason=reason,
        description=description,
    )
    analytics.track(user_id=reporter.id, event="report_created", properties={"reason": reason})
    return report
