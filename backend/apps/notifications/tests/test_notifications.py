from datetime import timedelta
from types import SimpleNamespace

import pytest
from django.urls import reverse
from django.utils import timezone
from pywebpush import WebPushException

from apps.locations.models import Availability
from apps.moderation.models import UserBlock
from apps.notifications.models import Notification, NotificationPreference, PushSubscription
from apps.notifications.services.nearby_notifications import notify_users_about_help_request
from apps.notifications.services.push import cleanup_invalid_subscriptions, deliver
from common.utils.geo import make_point
from tests.factories import (
    LVIV,
    HelpRequestFactory,
    HelpResponseFactory,
    PushSubscriptionFactory,
    UserFactory,
    offset_point,
)

pytestmark = pytest.mark.django_db


def subscriber(north_m=0, radius=3000, categories=None, push=True):
    user = UserFactory()
    prefs = NotificationPreference.objects.get(user=user)
    prefs.location = make_point(*offset_point(*LVIV, north_m=north_m))
    prefs.notification_radius = radius
    prefs.push_enabled = push
    if categories is not None:
        prefs.enabled_categories = categories
    prefs.save()
    PushSubscriptionFactory(user=user)
    return user


def recipients(hr):
    notify_users_about_help_request(hr)
    return set(
        Notification.objects.filter(help_request=hr, type="NEW_NEARBY_REQUEST").values_list("user_id", flat=True)
    )


class TestNearbyMatching:
    def test_radius_and_category_filtering(self, no_push):
        inside = subscriber(north_m=1000)
        outside = subscriber(north_m=5000, radius=3000)
        big_radius = subscriber(north_m=5000, radius=10000)
        no_auto = subscriber(north_m=100, categories=["HOME"])
        push_off = subscriber(north_m=100, push=False)
        hr = HelpRequestFactory(category="AUTO")
        result = recipients(hr)
        assert inside.id in result and big_radius.id in result
        assert not {outside.id, no_auto.id, push_off.id, hr.author_id} & result
        assert len(no_push) == 2  # push actually sent for two users
        body = Notification.objects.get(user=inside, help_request=hr).body
        assert "1,0 км від вас" in body
        assert hr.author.profile.display_name not in body  # no private data in push

    def test_excludes_author_blocked_and_without_subscription(self, no_push):
        blocked = subscriber(north_m=100)
        no_sub = subscriber(north_m=100)
        PushSubscription.objects.filter(user=no_sub).delete()
        hr = HelpRequestFactory()
        NotificationPreference.objects.filter(user=hr.author).update(location=hr.location)
        PushSubscriptionFactory(user=hr.author)
        UserBlock.objects.create(blocker=hr.author, blocked=blocked)
        assert recipients(hr) == set()

    def test_already_responded_excluded(self, no_push):
        user = subscriber(north_m=100)
        hr = HelpRequestFactory()
        HelpResponseFactory(help_request=hr, helper=user, status="CANCELLED")
        assert recipients(hr) == set()

    def test_muted_user_skipped_until_mute_ends(self, no_push):
        muted = subscriber(north_m=100)
        expired = subscriber(north_m=100)
        NotificationPreference.objects.filter(user=muted).update(muted_until=timezone.now() + timedelta(hours=1))
        NotificationPreference.objects.filter(user=expired).update(muted_until=timezone.now() - timedelta(minutes=1))
        assert recipients(HelpRequestFactory()) == {expired.id}

    def test_availability_location_used(self, no_push):
        user = UserFactory()
        PushSubscriptionFactory(user=user)
        Availability.objects.create(
            user=user,
            is_active=True,
            location=make_point(*offset_point(*LVIV, east_m=800)),
            radius=1000,
            categories=["AUTO"],
            expires_at=timezone.now() + timedelta(hours=1),
        )
        hr = HelpRequestFactory(category="AUTO")
        assert recipients(hr) == {user.id}

    def test_expired_availability_ignored(self, no_push):
        user = UserFactory()
        PushSubscriptionFactory(user=user)
        Availability.objects.create(
            user=user,
            is_active=True,
            location=make_point(*LVIV),
            radius=1000,
            categories=["AUTO"],
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        assert recipients(HelpRequestFactory()) == set()

    def test_rate_limit_and_urgent_separate(self, no_push, settings):
        settings.NOTIFICATION_NEARBY_LIMIT_PER_HOUR = 2
        user = subscriber(north_m=100)
        for _ in range(3):
            recipients(HelpRequestFactory(urgency="TODAY"))
        assert Notification.objects.filter(user=user).count() == 2
        recipients(HelpRequestFactory(urgency="NOW"))
        assert Notification.objects.filter(user=user).count() == 3

    def test_idempotent_and_closed_requests_skipped(self, no_push):
        user = subscriber(north_m=100)
        hr = HelpRequestFactory()
        notify_users_about_help_request(hr)
        notify_users_about_help_request(hr)
        assert Notification.objects.filter(user=user, help_request=hr).count() == 1
        closed = HelpRequestFactory(status="CANCELLED")
        assert recipients(closed) == set()

    def test_create_request_triggers_notifications(self, make_client, no_push, lviv):
        user = subscriber(north_m=200)
        client = make_client()
        client.post(
            "/api/v1/help-requests/",
            {"category": "AUTO", "description": "Сів акумулятор", "location": lviv, "urgency": "NOW"},
            format="json",
        )
        assert Notification.objects.filter(user=user, type="NEW_NEARBY_REQUEST").count() == 1
        payload = no_push[0]
        assert "/help/" in payload["data"]


class TestPushDelivery:
    def test_deliver_once(self, no_push):
        sub = PushSubscriptionFactory()
        n = Notification.objects.create(user=sub.user, type="NEW_MESSAGE", title="t", url="/chats/1")
        assert deliver(n.id) == 1
        assert deliver(n.id) == 0  # duplicate task does nothing
        sub.refresh_from_db()
        assert sub.last_used_at is not None

    def test_push_is_high_urgency(self, monkeypatch):
        """Low-priority pushes are delayed and shown without a popup on Android when the app is closed."""
        sent = {}
        monkeypatch.setattr("apps.notifications.services.push.webpush", lambda **kwargs: sent.update(kwargs))
        sub = PushSubscriptionFactory()
        deliver(Notification.objects.create(user=sub.user, type="NEW_MESSAGE", title="t").id)
        assert sent["headers"] == {"Urgency": "high"}

    def test_gone_subscription_deleted(self, monkeypatch):
        sub = PushSubscriptionFactory()

        def gone(**kwargs):
            raise WebPushException("gone", response=SimpleNamespace(status_code=410))

        monkeypatch.setattr("apps.notifications.services.push.webpush", gone)
        n = Notification.objects.create(user=sub.user, type="NEW_MESSAGE", title="t")
        assert deliver(n.id) == 0
        assert not PushSubscription.objects.filter(pk=sub.pk).exists()

    def test_failing_subscription_cleanup(self, monkeypatch):
        sub = PushSubscriptionFactory()

        def boom(**kwargs):
            raise WebPushException("err", response=SimpleNamespace(status_code=500))

        monkeypatch.setattr("apps.notifications.services.push.webpush", boom)
        for _ in range(3):
            deliver(Notification.objects.create(user=sub.user, type="NEW_MESSAGE", title="t").id)
        assert cleanup_invalid_subscriptions() == 1


class TestApi:
    def test_list_and_read(self, make_client):
        client = make_client()
        n = Notification.objects.create(user=client.user, type="NEW_MESSAGE", title="t")
        Notification.objects.create(user=UserFactory(), type="NEW_MESSAGE", title="other")
        data = client.get(reverse("notifications")).data
        assert data["count"] == 1 and data["unread_count"] == 1
        response = client.post(reverse("notification-read", args=[n.id]), {"via_push": True}, format="json")
        assert response.data["is_read"] is True
        n.refresh_from_db()
        assert n.push_opened_at is not None

    def test_push_subscription_upsert_and_delete(self, make_client):
        client = make_client()
        body = {"endpoint": "https://push.example.com/abc", "keys": {"p256dh": "k", "auth": "a"}}
        first = client.post(reverse("push-subscriptions"), body, format="json")
        assert first.status_code == 201
        # same endpoint re-registered by another user is moved to them
        other = make_client()
        assert other.post(reverse("push-subscriptions"), body, format="json").status_code == 200
        assert PushSubscription.objects.get(endpoint=body["endpoint"]).user == other.user
        assert other.delete(reverse("push-subscription-delete", args=[first.data["id"]])).status_code == 204
        assert not PushSubscription.objects.exists()

    def test_preferences(self, make_client):
        client = make_client()
        data = client.get(reverse("me-preferences")).data
        assert data["notification_radius"] == 3000
        assert "AUTO" in data["enabled_categories"]
        response = client.patch(
            reverse("me-preferences"),
            {
                "notification_radius": 1000,
                "enabled_categories": ["AUTO", "HOME"],
                "location": {"latitude": LVIV[0], "longitude": LVIV[1]},
            },
            format="json",
        )
        assert response.status_code == 200
        assert response.data["notification_radius"] == 1000 and response.data["has_location"] is True
        assert client.patch(reverse("me-preferences"), {"notification_radius": 1234}, format="json").status_code == 400
        assert client.patch(reverse("me-preferences"), {"enabled_categories": ["X"]}, format="json").status_code == 400
