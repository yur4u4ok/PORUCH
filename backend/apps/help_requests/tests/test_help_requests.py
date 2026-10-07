from datetime import timedelta

import pytest
from django.utils import timezone

from apps.help_requests.models import HelpRequest
from apps.help_requests.services.lifecycle import expire_help_requests
from apps.interactions.models import HelpResponse
from apps.moderation.models import UserBlock
from apps.notifications.models import Notification
from common.utils.geo import make_point
from tests.factories import LVIV, HelpRequestFactory, HelpResponseFactory, UserFactory, offset_point

pytestmark = pytest.mark.django_db

LIST_URL = "/api/v1/help-requests/"


def payload(location, **overrides):
    data = {
        "category": "AUTO",
        "subcategory": "FLAT_TIRE",
        "description": "Пробив колесо на парковці, потрібен домкрат",
        "location": location,
        "urgency": "NOW",
        "reward_type": "NONE",
    }
    data.update(overrides)
    return data


def nearby(client, lat=LVIV[0], lng=LVIV[1], **params):
    query = {"lat": lat, "lng": lng, **params}
    return client.get(LIST_URL, query)


def test_author_chooses_how_long_the_request_stays_active(auth_client, lviv):
    response = auth_client.post(LIST_URL, payload(lviv, urgency="TODAY", active_hours=5), format="json")
    hr = HelpRequest.objects.get(id=response.data["id"])
    assert timedelta(hours=4, minutes=59) < hr.expires_at - hr.created_at < timedelta(hours=5, minutes=1)
    assert auth_client.post(LIST_URL, payload(lviv, active_hours=500), format="json").status_code == 400


class TestScheduled:
    """Urgency SCHEDULED: help needed at a chosen date and time."""

    def test_scheduled_request_keeps_time_and_expires_after_it(self, auth_client, lviv):
        when = (timezone.now() + timedelta(days=2)).replace(microsecond=0)
        response = auth_client.post(
            LIST_URL, payload(lviv, urgency="SCHEDULED", needed_at=when.isoformat()), format="json"
        )
        assert response.status_code == 201, response.data
        hr = HelpRequest.objects.get(id=response.data["id"])
        assert hr.needed_at == when
        assert hr.expires_at == when + timedelta(hours=2)
        assert response.data["needed_at"] is not None

    @pytest.mark.parametrize(
        "needed_at",
        [None, timedelta(minutes=5), timedelta(days=31), -timedelta(hours=1)],
        ids=["missing", "too-soon", "too-far", "past"],
    )
    def test_invalid_time_is_rejected(self, auth_client, lviv, needed_at):
        when = None if needed_at is None else (timezone.now() + needed_at).isoformat()
        response = auth_client.post(LIST_URL, payload(lviv, urgency="SCHEDULED", needed_at=when), format="json")
        assert response.status_code == 400
        assert "needed_at" in response.data["details"]

    def test_needed_at_is_ignored_for_other_urgencies(self, auth_client, lviv):
        when = (timezone.now() + timedelta(days=1)).isoformat()
        response = auth_client.post(LIST_URL, payload(lviv, urgency="TODAY", needed_at=when), format="json")
        assert response.status_code == 201
        assert response.data["needed_at"] is None


class TestCreate:
    def test_create_request(self, auth_client, lviv):
        response = auth_client.post(LIST_URL, payload(lviv), format="json")
        assert response.status_code == 201, response.data
        data = response.data
        assert data["status"] == "ACTIVE"
        assert data["title"].startswith("Пробив колесо")
        assert data["is_author"] is True
        assert data["location"]["approximate"] is False
        hr = HelpRequest.objects.get(id=data["id"])
        assert timedelta(hours=5, minutes=59) < hr.expires_at - hr.created_at <= timedelta(hours=6)

    @pytest.mark.parametrize(("urgency", "hours"), [("TODAY", 24), ("WHENEVER", 72)])
    def test_expiration_by_urgency(self, auth_client, lviv, urgency, hours):
        response = auth_client.post(LIST_URL, payload(lviv, urgency=urgency), format="json")
        hr = HelpRequest.objects.get(id=response.data["id"])
        assert abs((hr.expires_at - hr.created_at) - timedelta(hours=hours)) < timedelta(minutes=1)

    def test_invalid_location_rejected(self, auth_client):
        response = auth_client.post(LIST_URL, payload({"latitude": 200, "longitude": 24}), format="json")
        assert response.status_code == 400
        assert response.data["code"] == "INVALID_LOCATION"

    def test_location_required(self, auth_client):
        data = payload(None)
        del data["location"]
        assert auth_client.post(LIST_URL, data, format="json").status_code == 400

    def test_description_max_length(self, auth_client, lviv):
        response = auth_client.post(LIST_URL, payload(lviv, description="x" * 1001), format="json")
        assert response.status_code == 400

    def test_urgent_requires_emergency_acknowledgement(self, auth_client, lviv):
        response = auth_client.post(LIST_URL, payload(lviv, category="URGENT", subcategory=None), format="json")
        assert response.status_code == 400
        assert response.data["code"] == "EMERGENCY_ACK_REQUIRED"
        ok = auth_client.post(
            LIST_URL,
            payload(lviv, category="URGENT", subcategory=None, emergency_acknowledged=True, urgency="TODAY"),
            format="json",
        )
        assert ok.status_code == 201
        assert ok.data["urgency"] == "NOW"

    def test_reward_amount_only_kept_for_willing(self, auth_client, lviv):
        r1 = auth_client.post(LIST_URL, payload(lviv, reward_type="NONE", reward_amount="100"), format="json")
        assert r1.data["reward_amount"] is None
        r2 = auth_client.post(LIST_URL, payload(lviv, reward_type="WILLING", reward_amount="150.50"), format="json")
        assert r2.data["reward_amount"] == "150.50"
        r3 = auth_client.post(LIST_URL, payload(lviv, reward_type="WILLING", reward_amount="-1"), format="json")
        assert r3.status_code == 400
        # «Готовий(-а) віддячити» needs an amount or at least one option
        r4 = auth_client.post(LIST_URL, payload(lviv, reward_type="WILLING"), format="json")
        assert r4.status_code == 400 and r4.data["code"] == "REWARD_REQUIRED"
        r5 = auth_client.post(
            LIST_URL, payload(lviv, reward_type="WILLING", reward_options=["COFFEE", "PIZZA"]), format="json"
        )
        assert (
            r5.status_code == 201
            and r5.data["reward_options"] == ["COFFEE", "PIZZA"]
            and r5.data["reward_amount"] is None
        )
        r6 = auth_client.post(LIST_URL, payload(lviv, reward_type="WILLING", reward_options=["CAKE"]), format="json")
        assert r6.status_code == 400
        r7 = auth_client.post(LIST_URL, payload(lviv, reward_type="NONE", reward_options=["COFFEE"]), format="json")
        assert r7.data["reward_options"] == []

    def test_unknown_subcategory(self, auth_client, lviv):
        response = auth_client.post(LIST_URL, payload(lviv, subcategory="LOST_PET"), format="json")
        assert response.status_code == 400

    def test_too_many_photos(self, auth_client, lviv):
        import uuid

        response = auth_client.post(
            LIST_URL, payload(lviv, photo_ids=[str(uuid.uuid4()) for _ in range(6)]), format="json"
        )
        assert response.status_code == 400

    def test_create_rate_limited(self, auth_client, lviv, settings):
        for _ in range(10):
            assert auth_client.post(LIST_URL, payload(lviv), format="json").status_code == 201
        assert auth_client.post(LIST_URL, payload(lviv), format="json").status_code == 429


class TestNearby:
    def test_distance_radius_and_ordering(self, auth_client):
        near = HelpRequestFactory(location=make_point(*offset_point(*LVIV, north_m=400)), urgency="WHENEVER")
        nearer_urgent = HelpRequestFactory(location=make_point(*offset_point(*LVIV, north_m=410)), urgency="NOW")
        mid = HelpRequestFactory(location=make_point(*offset_point(*LVIV, east_m=2500)))
        far = HelpRequestFactory(location=make_point(*offset_point(*LVIV, north_m=7000)))

        ids = [r["id"] for r in nearby(auth_client, radius=3000).data["results"]]
        # same 100 m bucket → urgency decides; then distance
        assert ids == [str(nearer_urgent.id), str(near.id), str(mid.id)]
        assert str(far.id) not in ids

        ids_500 = [r["id"] for r in nearby(auth_client, radius=500).data["results"]]
        assert set(ids_500) == {str(near.id), str(nearer_urgent.id)}
        ids_10k = [r["id"] for r in nearby(auth_client, radius=10000).data["results"]]
        assert str(far.id) in ids_10k

    def test_distance_is_rounded_and_location_approximate(self, auth_client):
        hr = HelpRequestFactory(location=make_point(*offset_point(*LVIV, north_m=1234)))
        result = nearby(auth_client).data["results"][0]
        assert result["id"] == str(hr.id)
        assert result["distance_m"] == 1200
        assert result["location"]["approximate"] is True
        assert (result["location"]["latitude"], result["location"]["longitude"]) != (hr.location.y, hr.location.x)

    def test_filters(self, auth_client):
        auto = HelpRequestFactory(category="AUTO", urgency="NOW")
        home = HelpRequestFactory(category="HOME", urgency="TODAY")
        assert [r["id"] for r in nearby(auth_client, category="HOME").data["results"]] == [str(home.id)]
        assert [r["id"] for r in nearby(auth_client, urgency="NOW").data["results"]] == [str(auto.id)]
        assert len(nearby(auth_client, category="AUTO,HOME").data["results"]) == 2
        assert nearby(auth_client, category="NOPE").status_code == 400

    def test_excludes_own_closed_expired_blocked(self, auth_client, user):
        HelpRequestFactory(author=user)
        HelpRequestFactory(status="COMPLETED", selected_helper=UserFactory())
        HelpRequestFactory(status="CANCELLED")
        HelpRequestFactory(expires_at=timezone.now() - timedelta(minutes=1))
        blocked_author = UserFactory()
        HelpRequestFactory(author=blocked_author)
        UserBlock.objects.create(blocker=blocked_author, blocked=user)
        visible = HelpRequestFactory()
        assert [r["id"] for r in nearby(auth_client).data["results"]] == [str(visible.id)]

    def test_requires_coordinates(self, auth_client):
        assert auth_client.get(LIST_URL).status_code == 400
        assert auth_client.get(LIST_URL, {"lat": 100, "lng": 24}).status_code == 400

    def test_invalid_radius(self, auth_client):
        assert nearby(auth_client, radius=2000).status_code == 400


class TestDetailAndPrivacy:
    def test_exact_location_only_for_participants(self, make_client):
        hr = HelpRequestFactory()
        stranger = make_client()
        data = stranger.get(f"{LIST_URL}{hr.id}/").data
        assert data["location"]["approximate"] is True
        assert data["can_respond"] is True
        HelpResponseFactory(help_request=hr, helper=stranger.user)
        data = stranger.get(f"{LIST_URL}{hr.id}/").data
        assert data["location"]["approximate"] is False
        assert data["location"]["latitude"] == pytest.approx(hr.location.y)
        assert data["my_response"]["status"] == "PENDING"
        assert data["can_respond"] is False

    def test_blocked_users_cannot_see_request(self, make_client):
        hr = HelpRequestFactory()
        client = make_client()
        UserBlock.objects.create(blocker=client.user, blocked=hr.author)
        assert client.get(f"{LIST_URL}{hr.id}/").status_code == 404

    def test_detail_invalid_uuid_is_404(self, auth_client):
        assert auth_client.get(f"{LIST_URL}not-a-uuid/").status_code == 404


class TestEditCancel:
    def test_only_author_can_edit_and_cancel(self, make_client):
        hr = HelpRequestFactory()
        other = make_client()
        assert other.patch(f"{LIST_URL}{hr.id}/", {"description": "x"}, format="json").status_code == 403
        assert other.post(f"{LIST_URL}{hr.id}/cancel/").status_code == 403
        author = make_client(hr.author)
        response = author.patch(f"{LIST_URL}{hr.id}/", {"description": "Оновлений опис"}, format="json")
        assert response.status_code == 200 and response.data["description"] == "Оновлений опис"
        assert author.post(f"{LIST_URL}{hr.id}/cancel/").data["status"] == "CANCELLED"
        # idempotent
        assert author.post(f"{LIST_URL}{hr.id}/cancel/").status_code == 200
        # cannot edit closed
        assert author.patch(f"{LIST_URL}{hr.id}/", {"description": "y"}, format="json").status_code == 409

    def test_delete_is_soft_cancel(self, make_client):
        hr = HelpRequestFactory()
        assert make_client(hr.author).delete(f"{LIST_URL}{hr.id}/").status_code == 204
        hr.refresh_from_db()
        assert hr.status == "CANCELLED"

    def test_cancel_rejects_pending_responses(self, make_client):
        hr = HelpRequestFactory()
        response = HelpResponseFactory(help_request=hr)
        make_client(hr.author).post(f"{LIST_URL}{hr.id}/cancel/")
        response.refresh_from_db()
        assert response.status == "CANCELLED"


class TestExpiration:
    def test_expire_task(self):
        old = HelpRequestFactory(expires_at=timezone.now() - timedelta(minutes=1))
        pending = HelpResponseFactory(help_request=old)
        fresh = HelpRequestFactory()
        in_progress = HelpRequestFactory(
            expires_at=timezone.now() - timedelta(minutes=1), status="IN_PROGRESS", selected_helper=UserFactory()
        )
        assert expire_help_requests() == 1
        for obj in (old, fresh, in_progress, pending):
            obj.refresh_from_db()
        assert old.status == "EXPIRED"
        assert pending.status == "CANCELLED"
        assert fresh.status == "ACTIVE"
        assert in_progress.status == "IN_PROGRESS"

    def test_expiring_notification_sent_once(self, no_push):
        hr = HelpRequestFactory(expires_at=timezone.now() + timedelta(minutes=30))
        expire_help_requests()
        expire_help_requests()
        assert Notification.objects.filter(user=hr.author, type="REQUEST_EXPIRING").count() == 1


class TestHistory:
    def test_roles(self, make_client):
        me = make_client()
        mine = HelpRequestFactory(author=me.user, status="COMPLETED", selected_helper=UserFactory())
        helped = HelpRequestFactory(selected_helper=me.user, status="IN_PROGRESS")
        HelpResponse.objects.create(help_request=helped, helper=me.user, status="ACCEPTED")
        responded = HelpRequestFactory()
        HelpResponse.objects.create(help_request=responded, helper=me.user)
        assert [r["id"] for r in me.get(LIST_URL, {"role": "author"}).data["results"]] == [str(mine.id)]
        assert [r["id"] for r in me.get(LIST_URL, {"role": "helper"}).data["results"]] == [str(helped.id)]
        assert [r["id"] for r in me.get(LIST_URL, {"role": "responded"}).data["results"]] == [str(responded.id)]
        active = me.get(LIST_URL, {"role": "author", "status": "ACTIVE,IN_PROGRESS"}).data["results"]
        assert active == []
