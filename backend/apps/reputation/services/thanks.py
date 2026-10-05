from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils.translation import gettext as _

from apps.help_requests.constants import HelpRequestStatus
from apps.help_requests.models import HelpRequest
from apps.notifications.models import NotificationType
from apps.notifications.services.notify import notify
from apps.reputation.models import ThankYou
from apps.users.models import Profile, User
from common import analytics
from common.exceptions import Forbidden, InvalidState, NotFound


@transaction.atomic
def create_thank_you(author: User, help_request_id, message: str = "") -> tuple[ThankYou, bool]:
    help_request = HelpRequest.objects.select_for_update().filter(id=help_request_id).first()
    if help_request is None:
        raise NotFound()
    if help_request.author_id != author.pk:
        raise Forbidden(_("Подякувати може тільки автор запиту."), code="NOT_AUTHOR")
    if help_request.status != HelpRequestStatus.COMPLETED or help_request.selected_helper_id is None:
        raise InvalidState(_("Подякувати можна після завершення допомоги."), code="REQUEST_NOT_COMPLETED")
    existing = ThankYou.objects.filter(help_request=help_request).first()
    if existing:
        return existing, False
    try:
        with transaction.atomic():
            thank_you = ThankYou.objects.create(
                from_user=author,
                to_user_id=help_request.selected_helper_id,
                help_request=help_request,
                message=(message or "").strip(),
            )
    except IntegrityError:
        return ThankYou.objects.get(help_request=help_request), False
    Profile.objects.filter(user_id=help_request.selected_helper_id).update(
        thanks_received_count=F("thanks_received_count") + 1
    )
    helper = help_request.selected_helper
    assert helper is not None
    notify(
        helper,
        NotificationType.THANK_YOU_RECEIVED,
        title=_("❤️ Вам подякували"),
        body=thank_you.message[:200] or _("Дякую за допомогу!"),
        url="/profile",
        help_request=help_request,
    )
    analytics.track(user_id=author.id, event="thanks_created", properties={"help_request_id": help_request.id})
    return thank_you, True
