from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils.translation import gettext as _

from apps.help_requests.constants import HelpRequestStatus
from apps.help_requests.models import HelpRequest
from apps.interactions.constants import ResponseStatus
from apps.interactions.models import HelpResponse
from apps.notifications.models import NotificationType
from apps.notifications.services.notify import notify
from apps.reputation.models import Review
from apps.users.models import Profile, User
from common import analytics
from common.exceptions import Conflict, Forbidden, InvalidState, NotFound
from common.i18n import in_language_of


def review_partners(help_request: HelpRequest, user: User) -> list:
    """Whom `user` may review on this request: the author → each chosen helper; a chosen helper → the author."""
    helper_ids = list(
        HelpResponse.objects.filter(help_request=help_request, status=ResponseStatus.ACCEPTED).values_list(
            "helper_id", flat=True
        )
    )
    if help_request.author_id == user.pk:
        return helper_ids
    if user.pk in helper_ids:
        return [help_request.author_id]
    return []


@transaction.atomic
def create_review(user: User, help_request_id, to_user_id, rating: int, text: str = "") -> Review:
    help_request = HelpRequest.objects.filter(id=help_request_id).first()
    if help_request is None:
        raise NotFound()
    if help_request.status != HelpRequestStatus.COMPLETED:
        raise InvalidState(_("Відгук можна залишити після завершення допомоги."), code="REQUEST_NOT_COMPLETED")
    if to_user_id not in review_partners(help_request, user):
        raise Forbidden(_("Залишити відгук можна тільки учаснику цієї допомоги."), code="NOT_A_PARTNER")
    try:
        with transaction.atomic():
            review = Review.objects.create(
                from_user=user, to_user_id=to_user_id, help_request=help_request, rating=rating, text=text.strip()
            )
    except IntegrityError as exc:
        raise Conflict(_("Ви вже залишили відгук цій людині."), code="ALREADY_REVIEWED") from exc
    Profile.objects.filter(user_id=to_user_id).update(
        reviews_count=F("reviews_count") + 1, rating_sum=F("rating_sum") + rating
    )
    with in_language_of(User.objects.get(pk=to_user_id)):
        notify(
            User.objects.get(pk=to_user_id),
            NotificationType.REVIEW_RECEIVED,
            title=_("⭐ Новий відгук: {stars}").format(stars="★" * rating),
            body=review.text[:200],
            url="/profile",
            help_request=help_request,
        )
    analytics.track(user_id=user.id, event="review_created", properties={"rating": rating})
    return review
