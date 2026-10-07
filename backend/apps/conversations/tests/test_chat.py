import uuid

import pytest
from channels.db import database_sync_to_async
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator

from apps.conversations import presence
from apps.conversations.models import Conversation, Message
from apps.conversations.routing import websocket_urlpatterns
from apps.interactions.services.responses import select_helper
from apps.moderation.models import UserBlock
from apps.notifications.models import Notification
from tests.factories import HelpRequestFactory, HelpResponseFactory, UserFactory


def setup_conversation():
    hr = HelpRequestFactory()
    resp = HelpResponseFactory(help_request=hr)
    _, _, conversation = select_helper(hr.author, hr.id, resp.id)
    return conversation, hr.author, resp.helper


def url(conversation, suffix=""):
    return f"/api/v1/conversations/{conversation.id}/{suffix}"


@pytest.mark.django_db
class TestChatApi:
    def test_list_and_detail(self, make_client):
        conversation, author, helper = setup_conversation()
        client = make_client(author)
        listing = client.get("/api/v1/conversations/").data["results"]
        assert listing[0]["id"] == str(conversation.id)
        assert listing[0]["other_participant"]["id"] == str(helper.id)
        assert listing[0]["last_message"]["message_type"] == "SYSTEM"
        assert client.get(url(conversation)).status_code == 200

    def test_non_participant_cannot_access(self, make_client):
        conversation, _, _ = setup_conversation()
        stranger = make_client()
        assert stranger.get(url(conversation)).status_code == 404
        assert stranger.get(url(conversation, "messages/")).status_code == 404
        assert stranger.post(url(conversation, "messages/"), {"text": "hi"}, format="json").status_code == 404

    def test_send_message_and_offline_push(self, make_client, no_push):
        conversation, author, helper = setup_conversation()
        client = make_client(author)
        response = client.post(url(conversation, "messages/"), {"text": "Я біля входу"}, format="json")
        assert response.status_code == 201
        assert response.data["sender_id"] == str(author.id)
        # helper is offline → NEW_MESSAGE notification
        assert Notification.objects.filter(user=helper, type="NEW_MESSAGE").count() == 1
        unread = make_client(helper).get("/api/v1/conversations/").data["results"][0]["unread_count"]
        assert unread == 1

    def test_online_recipient_gets_no_push_notification(self, make_client):
        conversation, author, helper = setup_conversation()
        presence.connect(conversation.id, helper.pk)
        make_client(author).post(url(conversation, "messages/"), {"text": "hi"}, format="json")
        assert not Notification.objects.filter(user=helper, type="NEW_MESSAGE").exists()

    def test_client_id_makes_send_idempotent(self, make_client):
        conversation, author, _ = setup_conversation()
        client = make_client(author)
        client_id = str(uuid.uuid4())
        first = client.post(url(conversation, "messages/"), {"text": "hi", "client_id": client_id}, format="json")
        second = client.post(url(conversation, "messages/"), {"text": "hi", "client_id": client_id}, format="json")
        assert first.status_code == 201 and second.status_code == 200
        assert first.data["id"] == second.data["id"]
        assert Message.objects.filter(client_id=client_id).count() == 1

    def test_empty_and_too_long_messages_rejected(self, make_client):
        conversation, author, _ = setup_conversation()
        client = make_client(author)
        assert client.post(url(conversation, "messages/"), {"text": "  "}, format="json").status_code == 400
        assert client.post(url(conversation, "messages/"), {"text": "x" * 3001}, format="json").status_code == 400

    def test_blocked_cannot_message(self, make_client):
        conversation, author, helper = setup_conversation()
        UserBlock.objects.create(blocker=helper, blocked=author)
        response = make_client(author).post(url(conversation, "messages/"), {"text": "hi"}, format="json")
        assert response.status_code == 403

    def test_mark_read(self, make_client):
        conversation, author, helper = setup_conversation()
        make_client(author).post(url(conversation, "messages/"), {"text": "hi"}, format="json")
        helper_client = make_client(helper)
        assert helper_client.post(url(conversation, "read/"), {}, format="json").data["marked"] == 1
        message = Message.objects.filter(conversation=conversation, sender=author).get()
        assert message.read_at is not None
        assert helper_client.get("/api/v1/conversations/").data["results"][0]["unread_count"] == 0

    def test_messages_paginated_newest_first(self, make_client):
        conversation, author, _ = setup_conversation()
        client = make_client(author)
        for i in range(3):
            client.post(url(conversation, "messages/"), {"text": f"m{i}"}, format="json")
        results = client.get(url(conversation, "messages/")).data["results"]
        assert [m["text"] for m in results[:3]] == ["m2", "m1", "m0"]

    def test_closed_conversation_is_read_only(self, make_client):
        conversation, author, _ = setup_conversation()
        Conversation.objects.filter(pk=conversation.pk).update(closed_at="2026-01-01T00:00:00Z")
        response = make_client(author).post(url(conversation, "messages/"), {"text": "hi"}, format="json")
        assert response.status_code == 409


def _communicator(conversation_id, user):
    app = URLRouter(websocket_urlpatterns)
    communicator = WebsocketCommunicator(app, f"/ws/conversations/{conversation_id}/")
    communicator.scope["user"] = user
    return communicator


@pytest.mark.django_db(transaction=True)
async def test_websocket_flow():
    conversation, author, helper = await database_sync_to_async(setup_conversation)()

    stranger = await database_sync_to_async(UserFactory)()
    denied = _communicator(conversation.id, stranger)
    connected, code = await denied.connect()
    assert not connected

    ws_author = _communicator(conversation.id, author)
    assert (await ws_author.connect())[0]
    ws_helper = _communicator(conversation.id, helper)
    assert (await ws_helper.connect())[0]

    # Presence events may arrive in any order and may repeat (idempotent).
    assert (await receive_event(ws_helper, "user.online"))["payload"]["user_id"] == str(author.id)
    assert (await receive_event(ws_author, "user.online"))["payload"]["user_id"] == str(helper.id)

    await ws_helper.send_json_to({"type": "typing.started"})
    event = await receive_event(ws_author, "typing.started")
    assert event["payload"] == {"user_id": str(helper.id)}

    from apps.conversations.services.conversations import send_message

    await database_sync_to_async(send_message)(author, conversation.id, text="Привіт")
    for ws in (ws_author, ws_helper):
        event = await receive_event(ws, "message.created")
        assert event["payload"]["text"] == "Привіт"

    # helper is online in the conversation → no NEW_MESSAGE notification
    exists = await database_sync_to_async(Notification.objects.filter(user=helper, type="NEW_MESSAGE").exists)()
    assert not exists

    await ws_helper.send_json_to({"type": "ping"})
    assert (await receive_event(ws_helper, "pong"))["event"] == "pong"

    await ws_helper.disconnect()
    assert (await receive_event(ws_author, "user.offline"))["payload"]["user_id"] == str(helper.id)
    await ws_author.disconnect()


async def receive_event(ws, name, attempts=10):
    for _ in range(attempts):
        event = await ws.receive_json_from(timeout=2)
        if event["event"] == name:
            return event
    raise AssertionError(f"event {name} not received")


@pytest.mark.django_db
class TestRepliesReactionsPresence:
    def test_reply_quotes_a_message_from_the_same_chat(self, make_client, no_push):
        conversation, author, helper = setup_conversation()
        first = make_client(helper).post(url(conversation, "messages/"), {"text": "Буду о 18:00"}, format="json").data
        reply = (
            make_client(author)
            .post(url(conversation, "messages/"), {"text": "Добре", "reply_to_id": first["id"]}, format="json")
            .data
        )
        assert reply["reply_to"]["id"] == first["id"] and reply["reply_to"]["text"] == "Буду о 18:00"
        other, _, _ = setup_conversation()
        foreign = Message.objects.filter(conversation=other).first()
        stray = (
            make_client(author)
            .post(url(conversation, "messages/"), {"text": "x", "reply_to_id": str(foreign.id)}, format="json")
            .data
        )
        assert stray["reply_to"] is None  # another chat's message is never quoted

    def test_reaction_toggles_and_replaces(self, make_client, no_push):
        conversation, author, helper = setup_conversation()
        message = make_client(helper).post(url(conversation, "messages/"), {"text": "Привіт"}, format="json").data
        client = make_client(author)
        react_url = url(conversation, f"messages/{message['id']}/reactions/")
        data = client.post(react_url, {"emoji": "👍"}, format="json").data
        assert data["reactions"] == [{"emoji": "👍", "user_ids": [str(author.id)]}]
        data = client.post(react_url, {"emoji": "❤️"}, format="json").data
        assert data["reactions"] == [{"emoji": "❤️", "user_ids": [str(author.id)]}]  # replaced
        data = client.post(react_url, {"emoji": "❤️"}, format="json").data
        assert data["reactions"] == []  # same again removes it
        assert client.post(react_url, {"emoji": "💩"}, format="json").status_code == 400
        assert make_client().post(react_url, {"emoji": "👍"}, format="json").status_code == 404

    def test_other_online_in_chat_list(self, make_client):
        conversation, author, helper = setup_conversation()
        client = make_client(author)
        assert client.get("/api/v1/conversations/").data["results"][0]["other_online"] is False
        make_client(helper).get("/api/v1/me/")  # any request marks the helper as online
        assert client.get("/api/v1/conversations/").data["results"][0]["other_online"] is True
