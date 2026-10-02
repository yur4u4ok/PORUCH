import pytest
from django.urls import reverse

from apps.locations.models import Availability
from apps.notifications.models import PushSubscription
from tests.factories import HelpRequestFactory, PushSubscriptionFactory, UserFactory

pytestmark = pytest.mark.django_db


def test_me_get_and_patch(auth_client):
    response = auth_client.patch(reverse("me"), {"display_name": "  Остап ", "show_name": False}, format="json")
    assert response.status_code == 200
    assert response.data["display_name"] == "Остап"
    assert response.data["show_name"] is False
    assert "email" in response.data


def test_capabilities_catalog_and_set(auth_client):
    catalog = auth_client.get(reverse("capabilities")).data
    codes = {c["code"] for c in catalog}
    assert {"AUTO_TIRE", "HOUSE_MOVING", "OTHER", "HAS_COMPRESSOR"} <= codes
    response = auth_client.put(reverse("me-capabilities"), {"codes": ["AUTO_TIRE", "DELIVERY"]}, format="json")
    assert response.status_code == 200
    assert {c["code"] for c in response.data} == {"AUTO_TIRE", "DELIVERY"}
    response = auth_client.put(reverse("me-capabilities"), {"codes": ["DELIVERY"]}, format="json")
    assert [c["code"] for c in response.data] == ["DELIVERY"]
    bad = auth_client.put(reverse("me-capabilities"), {"codes": ["NOPE"]}, format="json")
    assert bad.status_code == 400


def test_public_profile_hides_private_fields(make_client):
    target = UserFactory()
    target.profile.show_name = False
    target.profile.save()
    response = make_client().get(reverse("user-profile", args=[target.id]))
    assert response.status_code == 200
    assert response.data["display_name"] is None
    assert "email" not in response.data
    assert "helped_count" in response.data and "capabilities" in response.data


def test_blocked_user_profile_is_hidden(make_client):
    from apps.moderation.models import UserBlock

    viewer_client = make_client()
    target = UserFactory()
    UserBlock.objects.create(blocker=target, blocked=viewer_client.user)
    assert viewer_client.get(reverse("user-profile", args=[target.id])).status_code == 404


def test_deactivate_account(auth_client, user):
    PushSubscriptionFactory(user=user)
    Availability.objects.create(user=user, is_active=True)
    active = HelpRequestFactory(author=user)
    response = auth_client.post(reverse("me-deactivate"))
    assert response.status_code == 204
    user.refresh_from_db()
    active.refresh_from_db()
    assert not user.is_active and user.deactivated_at
    assert not PushSubscription.objects.filter(user=user).exists()
    assert not Availability.objects.get(user=user).is_active
    assert active.status == "CANCELLED"


def test_custom_items_and_general_item_catalog(auth_client):
    codes = {c["code"] for c in auth_client.get(reverse("capabilities")).data}
    assert {"HAS_OTHER", "HAS_LADDER", "HAS_FIRST_AID"} <= codes
    assert "HAS_JACK" not in codes  # retired car-only item
    response = auth_client.patch(reverse("me"), {"custom_items": [" Велосипед ", "Тачка", "Велосипед"]}, format="json")
    assert response.data["custom_items"] == ["Велосипед", "Тачка"]
    too_long = auth_client.patch(reverse("me"), {"custom_items": ["x" * 41]}, format="json")
    assert too_long.status_code == 400
    public = auth_client.get(reverse("user-profile", args=[auth_client.user.id])).data
    assert public["custom_items"] == ["Велосипед", "Тачка"]
