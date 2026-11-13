import pytest

from apps.conversations.models import Conversation, Message
from apps.help_requests.models import HelpRequest
from apps.notifications.models import Notification
from apps.reputation.models import Review
from apps.users.models import User
from tests.factories import HelpRequestFactory, UserFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/me/delete/"


def test_wrong_password_keeps_the_account(auth_client, user):
    assert auth_client.post(URL, {"password": "wrong"}, format="json").status_code == 400
    user.refresh_from_db()
    assert user.is_active and user.deleted_at is None


def test_deleting_erases_personal_data_but_keeps_what_others_need(auth_client, user):
    old_email = user.email
    helper = UserFactory()
    request = HelpRequestFactory(
        author=user, title="Забрати ліки", place_name="вул. Зелена, 5", status="COMPLETED", selected_helper=helper
    )
    conversation = Conversation.objects.create(help_request=request, helper=helper)
    Message.objects.create(conversation=conversation, sender=user, text="Мій номер 0991234567")
    Review.objects.create(help_request=request, from_user=user, to_user=helper, rating=5, text="Дякую!")
    Notification.objects.create(user=user, type="REQUEST_EXPIRING", title="x")

    response = auth_client.post(URL, {"password": "Str0ng-pass!"}, format="json")
    assert response.status_code == 204

    user = User.objects.get(pk=user.pk)
    assert not user.is_active and user.deleted_at is not None
    assert user.email.endswith("@deleted.invalid") and not user.has_usable_password()
    assert user.profile.display_name == "Видалений користувач"
    assert not Notification.objects.filter(user=user).exists()
    # the helper's chat and the review they received stay, without the deleted person's words
    assert Message.objects.get(conversation=conversation, sender=user).text == "Повідомлення видалено"
    assert Review.objects.filter(to_user=helper).exists()
    request = HelpRequest.objects.get(pk=request.pk)
    assert request.title == "Запит видалено" and request.place_name == ""
    # the old address is free: the same person can sign up again from scratch
    assert not User.objects.filter(email=old_email).exists()
