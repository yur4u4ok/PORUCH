import pytest
from rest_framework.test import APIClient

from apps.moderation.models import Report, UserBlock
from tests.factories import HelpRequestFactory, HelpResponseFactory, UserFactory

pytestmark = pytest.mark.django_db


def test_block_and_unblock(make_client):
    client = make_client()
    target = UserFactory()
    response = client.post("/api/v1/blocks/", {"user_id": str(target.id)}, format="json")
    assert response.status_code == 201
    assert client.post("/api/v1/blocks/", {"user_id": str(target.id)}, format="json").status_code == 201  # idempotent
    assert UserBlock.objects.filter(blocker=client.user).count() == 1
    assert client.get("/api/v1/blocks/").data["results"][0]["user"]["id"] == str(target.id)
    assert client.delete(f"/api/v1/blocks/{target.id}/").status_code == 204
    assert not UserBlock.objects.exists()


def test_cannot_block_self(make_client):
    client = make_client()
    assert client.post("/api/v1/blocks/", {"user_id": str(client.user.id)}, format="json").status_code == 400


def test_block_cancels_pending_responses(make_client):
    hr = HelpRequestFactory()
    resp = HelpResponseFactory(help_request=hr)
    make_client(hr.author).post("/api/v1/blocks/", {"user_id": str(resp.helper_id)}, format="json")
    resp.refresh_from_db()
    assert resp.status == "CANCELLED"


def test_db_unique_block_pair():
    from django.db import IntegrityError, transaction

    a, b = UserFactory(), UserFactory()
    UserBlock.objects.create(blocker=a, blocked=b)
    with pytest.raises(IntegrityError), transaction.atomic():
        UserBlock.objects.create(blocker=a, blocked=b)


def test_report_request_and_user(make_client):
    client = make_client()
    hr = HelpRequestFactory()
    response = client.post(
        "/api/v1/reports/", {"reason": "SPAM", "help_request_id": str(hr.id), "description": "Реклама"}, format="json"
    )
    assert response.status_code == 201
    report = Report.objects.get()
    assert report.target_user == hr.author and report.status == "OPEN"
    assert client.post("/api/v1/reports/", {"reason": "SPAM"}, format="json").status_code == 400
    assert (
        client.post(
            "/api/v1/reports/", {"reason": "BAD", "target_user_id": str(hr.author_id)}, format="json"
        ).status_code
        == 400
    )


def test_cannot_report_message_from_foreign_conversation(make_client):
    from apps.conversations.models import Message
    from apps.interactions.services.responses import select_helper

    hr = HelpRequestFactory()
    resp = HelpResponseFactory(help_request=hr)
    _, _, conversation = select_helper(hr.author, hr.id, resp.id)
    message = Message.objects.filter(conversation=conversation).first()
    stranger = make_client()
    response = stranger.post("/api/v1/reports/", {"reason": "SPAM", "message_id": str(message.id)}, format="json")
    assert response.status_code == 400


def test_support_message_is_emailed_with_reply_to_user(settings, django_capture_on_commit_callbacks):
    from django.core import mail

    settings.SUPPORT_EMAIL = "support@example.com"
    settings.CELERY_TASK_ALWAYS_EAGER = True
    user = UserFactory()
    client = APIClient()
    client.force_authenticate(user)
    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(
            "/api/v1/support/", {"topic": "BUG", "message": "Карта не відкривається", "page": "/nearby"}, format="json"
        )
    assert response.status_code == 202
    assert len(mail.outbox) == 1
    sent = mail.outbox[0]
    assert sent.to == ["support@example.com"] and sent.reply_to == [user.email]
    assert "Карта не відкривається" in sent.body and "/nearby" in sent.body


def test_support_requires_login():
    assert APIClient().post("/api/v1/support/", {"topic": "BUG", "message": "x"}).status_code == 401
