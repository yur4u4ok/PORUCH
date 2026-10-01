from datetime import timedelta

import pytest
from django.utils import timezone

from apps.locations.models import Availability
from apps.locations.services.availability import expire_availability

pytestmark = pytest.mark.django_db


def test_availability_lifecycle(auth_client, lviv):
    assert auth_client.get("/api/v1/availability/").data["active"] is False
    response = auth_client.post(
        "/api/v1/availability/", {**lviv, "radius": 3000, "categories": ["AUTO"]}, format="json"
    )
    assert response.status_code == 200
    assert response.data["active"] is True and response.data["categories"] == ["AUTO"]
    availability = Availability.objects.get(user=auth_client.user)
    assert timedelta(hours=1, minutes=59) < availability.expires_at - timezone.now() <= timedelta(hours=2)
    assert auth_client.delete("/api/v1/availability/").status_code == 204
    assert auth_client.get("/api/v1/availability/").data["active"] is False


def test_availability_validation(auth_client, lviv):
    assert auth_client.post("/api/v1/availability/", {**lviv, "radius": 123}, format="json").status_code == 400
    assert auth_client.post("/api/v1/availability/", {"latitude": 99, "longitude": 1}, format="json").status_code == 400
    assert (
        auth_client.post("/api/v1/availability/", {**lviv, "duration_minutes": 60 * 24}, format="json").status_code
        == 400
    )


def test_expire_availability(user):
    Availability.objects.create(user=user, is_active=True, expires_at=timezone.now() - timedelta(minutes=1))
    assert expire_availability() == 1
    assert not Availability.objects.get(user=user).is_active


def test_cities_public(api_client):
    data = api_client.get("/api/v1/cities/").data
    assert data[0]["slug"] == "lviv" and data[0]["is_default"] is True
