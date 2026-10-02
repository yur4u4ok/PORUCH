import threading

import pytest
from django.db import close_old_connections
from django.urls import reverse

from apps.conversations.models import Conversation, Message
from apps.help_requests.models import HelpRequest
from apps.interactions.models import HelpResponse
from apps.interactions.services.responses import select_helper
from apps.moderation.models import UserBlock
from apps.notifications.models import Notification
from apps.users.models import Profile
from common.exceptions import DomainError
from tests.factories import HelpRequestFactory, HelpResponseFactory, UserFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/help-requests/"


def respond(client, hr, message="Буду за 10 хв"):
    return client.post(f"{URL}{hr.id}/respond/", {"message": message}, format="json")


class TestRespond:
    def test_respond_creates_pending_and_notifies_author(self, make_client, no_push):
        hr = HelpRequestFactory()
        helper = make_client()
        response = respond(helper, hr)
        assert response.status_code == 201
        assert response.data["status"] == "PENDING"
        assert Notification.objects.filter(user=hr.author, type="HELP_RESPONSE_RECEIVED").exists()
        hr.refresh_from_db()
        assert hr.first_response_at is not None

    def test_respond_is_idempotent(self, make_client):
        hr = HelpRequestFactory()
        helper = make_client()
        first = respond(helper, hr)
        second = respond(helper, hr)
        assert second.status_code == 200
        assert first.data["id"] == second.data["id"]
        assert HelpResponse.objects.filter(help_request=hr).count() == 1

    def test_cannot_respond_to_own_request(self, make_client):
        hr = HelpRequestFactory()
        response = respond(make_client(hr.author), hr)
        assert response.status_code == 403
        assert response.data["code"] == "OWN_REQUEST"

    @pytest.mark.parametrize("status", ["CANCELLED", "COMPLETED", "EXPIRED"])
    def test_cannot_respond_to_closed(self, make_client, status):
        extra = {"selected_helper": UserFactory()} if status == "COMPLETED" else {}
        hr = HelpRequestFactory(status=status, **extra)
        response = respond(make_client(), hr)
        assert response.status_code == 409
        assert response.data["code"] == "REQUEST_NOT_ACTIVE"

    def test_blocked_cannot_respond(self, make_client):
        hr = HelpRequestFactory()
        helper = make_client()
        UserBlock.objects.create(blocker=hr.author, blocked=helper.user)
        assert respond(helper, hr).status_code == 404

    def test_rejected_helper_cannot_respond_again(self, make_client):
        hr = HelpRequestFactory()
        helper = make_client()
        HelpResponseFactory(help_request=hr, helper=helper.user, status="REJECTED")
        assert respond(helper, hr).status_code == 409

    def test_db_constraint_unique_active_response(self):
        from django.db import IntegrityError, transaction

        hr = HelpRequestFactory()
        helper = UserFactory()
        HelpResponse.objects.create(help_request=hr, helper=helper)
        with pytest.raises(IntegrityError), transaction.atomic():
            HelpResponse.objects.create(help_request=hr, helper=helper)

    def test_author_sees_responses_others_do_not(self, make_client):
        hr = HelpRequestFactory()
        HelpResponseFactory(help_request=hr)
        author = make_client(hr.author)
        data = author.get(f"{URL}{hr.id}/responses/").data
        assert len(data) == 1
        assert "helped_count" in data[0]["helper"]
        assert make_client().get(f"{URL}{hr.id}/responses/").status_code == 403


class TestSelectHelper:
    def test_select_helper_transitions_and_creates_conversation(self, make_client, no_push):
        hr = HelpRequestFactory()
        chosen = HelpResponseFactory(help_request=hr)
        other = HelpResponseFactory(help_request=hr)
        author = make_client(hr.author)
        response = author.post(f"{URL}{hr.id}/select-helper/", {"response_id": str(chosen.id)}, format="json")
        assert response.status_code == 200, response.data
        assert response.data["status"] == "IN_PROGRESS"
        assert response.data["selected_helper"]["id"] == str(chosen.helper_id)
        assert response.data["conversation_id"]
        chosen.refresh_from_db()
        other.refresh_from_db()
        assert chosen.status == "ACCEPTED"
        assert other.status == "REJECTED"
        conversation = Conversation.objects.get(help_request=hr)
        assert set(conversation.participants.values_list("user_id", flat=True)) == {hr.author_id, chosen.helper_id}
        assert Message.objects.filter(conversation=conversation, message_type="SYSTEM").exists()
        assert Notification.objects.filter(user=chosen.helper, type="HELP_RESPONSE_ACCEPTED").exists()
        assert Notification.objects.filter(user=other.helper, type="HELP_RESPONSE_REJECTED").exists()

    def test_select_helper_is_idempotent(self, make_client):
        hr = HelpRequestFactory()
        chosen = HelpResponseFactory(help_request=hr)
        author = make_client(hr.author)
        url = f"{URL}{hr.id}/select-helper/"
        first = author.post(url, {"response_id": str(chosen.id)}, format="json")
        second = author.post(url, {"response_id": str(chosen.id)}, format="json")
        assert first.status_code == second.status_code == 200
        assert Conversation.objects.filter(help_request=hr).count() == 1

    def test_second_helper_cannot_be_selected(self, make_client):
        hr = HelpRequestFactory()
        a = HelpResponseFactory(help_request=hr)
        b = HelpResponseFactory(help_request=hr)
        author = make_client(hr.author)
        author.post(f"{URL}{hr.id}/select-helper/", {"response_id": str(a.id)}, format="json")
        response = author.post(f"{URL}{hr.id}/select-helper/", {"response_id": str(b.id)}, format="json")
        assert response.status_code == 409

    def test_only_author_can_select(self, make_client):
        hr = HelpRequestFactory()
        resp = HelpResponseFactory(help_request=hr)
        response = make_client(resp.helper).post(
            f"{URL}{hr.id}/select-helper/", {"response_id": str(resp.id)}, format="json"
        )
        assert response.status_code == 403

    def test_accept_and_reject_endpoints(self, make_client):
        hr = HelpRequestFactory()
        a = HelpResponseFactory(help_request=hr)
        b = HelpResponseFactory(help_request=hr)
        author = make_client(hr.author)
        assert author.post(f"/api/v1/help-responses/{b.id}/reject/").data["status"] == "REJECTED"
        assert author.post(f"/api/v1/help-responses/{a.id}/accept/").data["status"] == "ACCEPTED"
        hr.refresh_from_db()
        assert hr.status == "IN_PROGRESS" and hr.selected_helper_id == a.helper_id
        # third party cannot even see the response
        assert make_client().get(f"/api/v1/help-responses/{a.id}/").status_code == 404

    def test_helper_withdraws_after_acceptance(self, make_client):
        hr = HelpRequestFactory()
        resp = HelpResponseFactory(help_request=hr)
        select_helper(hr.author, hr.id, resp.id)
        helper = make_client(resp.helper)
        assert helper.post(f"/api/v1/help-responses/{resp.id}/cancel/").data["status"] == "CANCELLED"
        hr.refresh_from_db()
        assert hr.status == "ACTIVE" and hr.selected_helper is None
        assert Conversation.objects.get(help_request=hr).closed_at is not None


@pytest.mark.django_db(transaction=True)
def test_concurrent_helper_selection_only_one_wins():
    """Two simultaneous select-helper calls: exactly one succeeds (select_for_update)."""
    hr = HelpRequestFactory()
    responses = [HelpResponseFactory(help_request=hr) for _ in range(2)]
    barrier = threading.Barrier(2)
    results: list[str] = []

    def worker(response_id):
        close_old_connections()
        try:
            barrier.wait()
            select_helper(hr.author, hr.id, response_id)
            results.append("ok")
        except DomainError as exc:
            results.append(exc.code)
        finally:
            close_old_connections()

    threads = [threading.Thread(target=worker, args=(r.id,)) for r in responses]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sorted(results) == ["REQUEST_NOT_ACTIVE", "ok"]
    hr.refresh_from_db()
    assert hr.status == "IN_PROGRESS"
    assert HelpResponse.objects.filter(help_request=hr, status="ACCEPTED").count() == 1
    assert Conversation.objects.filter(help_request=hr).count() == 1


class TestCompletionAndThanks:
    def _in_progress(self):
        hr = HelpRequestFactory()
        resp = HelpResponseFactory(help_request=hr)
        select_helper(hr.author, hr.id, resp.id)
        hr.refresh_from_db()
        return hr, resp.helper

    def test_complete_and_thank(self, make_client, no_push):
        hr, helper = self._in_progress()
        author = make_client(hr.author)
        # Rule 8: thank-you only after COMPLETED
        assert author.post(f"{URL}{hr.id}/thank-you/", {"message": "Дякую!"}, format="json").status_code == 409
        # Rule 7: only author completes
        assert make_client(helper).post(f"{URL}{hr.id}/complete/").status_code == 403
        response = author.post(f"{URL}{hr.id}/complete/")
        assert response.status_code == 200 and response.data["status"] == "COMPLETED"
        assert response.data["thanked"] is False
        assert author.post(f"{URL}{hr.id}/complete/").status_code == 200  # idempotent
        assert Profile.objects.get(user=helper).helped_count == 1
        assert Notification.objects.filter(user=helper, type="REQUEST_COMPLETED").exists()

        thanks = author.post(f"{URL}{hr.id}/thank-you/", {"message": "Дякую!"}, format="json")
        assert thanks.status_code == 201
        again = author.post(f"{URL}{hr.id}/thank-you/", {"message": "Ще раз"}, format="json")
        assert again.status_code == 200 and again.data["id"] == thanks.data["id"]
        profile = Profile.objects.get(user=helper)
        assert profile.thanks_received_count == 1 and profile.helped_count == 1
        assert Notification.objects.filter(user=helper, type="THANK_YOU_RECEIVED").exists()
        listing = author.get(f"/api/v1/users/{helper.id}/thanks/").data["results"]
        assert listing[0]["message"] == "Дякую!"

    def test_cannot_complete_active(self, make_client):
        hr = HelpRequestFactory()
        assert make_client(hr.author).post(f"{URL}{hr.id}/complete/").status_code == 409

    def test_only_author_thanks(self, make_client):
        hr, helper = self._in_progress()
        make_client(hr.author).post(f"{URL}{hr.id}/complete/")
        assert make_client(helper).post(f"{URL}{hr.id}/thank-you/", {}, format="json").status_code == 403

    def test_public_profile_reflects_reputation(self, make_client):
        hr, helper = self._in_progress()
        author = make_client(hr.author)
        author.post(f"{URL}{hr.id}/complete/")
        author.post(f"{URL}{hr.id}/thank-you/", {}, format="json")
        data = make_client().get(reverse("user-profile", args=[helper.id])).data
        assert data["helped_count"] == 1 and data["thanks_received_count"] == 1
        assert HelpRequest.objects.get(id=hr.id).status == "COMPLETED"


class TestRewardOffers:
    def _willing(self, **kw):
        return HelpRequestFactory(reward_type="WILLING", reward_amount=500, reward_options=["PIZZA"], **kw)

    def test_counter_offer_is_agreed_on_selection(self, make_client, no_push):
        hr = self._willing()
        helper = make_client()
        response = helper.post(
            f"{URL}{hr.id}/respond/", {"offer_type": "COUNTER", "offered_amount": "400"}, format="json"
        )
        assert response.status_code == 201
        assert response.data["offer_type"] == "COUNTER" and response.data["offered_amount"] == "400.00"
        note = Notification.objects.get(user=hr.author, type="HELP_RESPONSE_RECEIVED")
        assert "400 грн" in note.body
        data = (
            make_client(hr.author)
            .post(f"{URL}{hr.id}/select-helper/", {"response_id": response.data["id"]}, format="json")
            .data
        )
        assert data["agreed_offer_type"] == "COUNTER" and data["agreed_amount"] == "400.00"
        texts = list(Message.objects.filter(conversation__help_request=hr).values_list("text", flat=True))
        assert any("Домовленість про подяку: 400 грн" in t for t in texts)

    def test_accept_author_terms_and_free_help(self, make_client):
        hr = self._willing()
        accept = make_client().post(f"{URL}{hr.id}/respond/", {"offer_type": "ACCEPT"}, format="json").data
        free = make_client().post(f"{URL}{hr.id}/respond/", {"offer_type": "FREE"}, format="json").data
        assert free["offered_amount"] is None
        author = make_client(hr.author)
        author.post(f"{URL}{hr.id}/select-helper/", {"response_id": accept["id"]}, format="json")
        hr.refresh_from_db()
        assert hr.agreed_offer_type == "ACCEPT" and hr.agreed_amount == 500
        texts = list(Message.objects.filter(conversation__help_request=hr).values_list("text", flat=True))
        assert any("500 грн, Поставлю піцу" in t for t in texts)

    def test_counter_requires_amount(self, make_client):
        hr = self._willing()
        response = make_client().post(f"{URL}{hr.id}/respond/", {"offer_type": "COUNTER"}, format="json")
        assert response.status_code == 400 and "offered_amount" in response.data["details"]

    def test_offer_ignored_without_reward(self, make_client):
        hr = HelpRequestFactory(reward_type="NONE")
        data = (
            make_client()
            .post(f"{URL}{hr.id}/respond/", {"offer_type": "COUNTER", "offered_amount": "100"}, format="json")
            .data
        )
        assert data["offer_type"] == "ACCEPT" and data["offered_amount"] is None

    def test_withdraw_resets_agreement(self, make_client):
        hr = self._willing()
        resp = HelpResponseFactory(help_request=hr, offer_type="FREE")
        select_helper(hr.author, hr.id, resp.id)
        make_client(resp.helper).post(f"/api/v1/help-responses/{resp.id}/cancel/")
        hr.refresh_from_db()
        assert hr.agreed_offer_type is None and hr.status == "ACTIVE"


@pytest.mark.django_db(transaction=True)
def test_respond_runs_in_its_own_transaction():
    """Regression: respond() uses select_for_update and must open its own transaction."""
    from apps.interactions.services.responses import respond

    hr = HelpRequestFactory(reward_type="WILLING", reward_amount=500)
    response, created = respond(UserFactory(), hr.id, "", "COUNTER", 400)
    assert created and response.offered_amount == 400
