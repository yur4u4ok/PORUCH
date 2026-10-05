import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from tests.factories import LVIV, UserFactory


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def _run_on_commit_immediately(monkeypatch):
    """Execute transaction.on_commit callbacks immediately in tests (no TestCase wrapping issues)."""
    from django.db import transaction

    monkeypatch.setattr(transaction, "on_commit", lambda func, using=None, robust=False: func())


@pytest.fixture(autouse=True)
def _reference_data(request):
    """Transactional tests flush the DB (incl. migration seed data); restore it when needed."""
    if "db" not in request.fixturenames and "transactional_db" not in request.fixturenames:
        marker = request.node.get_closest_marker("django_db")
        if marker is None:
            return
    request.getfixturevalue("transactional_db" if _is_transactional(request) else "db")
    from apps.locations.models import City
    from apps.locations.reference_data import seed_default_city
    from apps.users.models import Capability
    from apps.users.reference_data import seed_capabilities

    if not City.objects.exists():
        seed_default_city(City)
    if not Capability.objects.exists():
        seed_capabilities(Capability)


def _is_transactional(request) -> bool:
    marker = request.node.get_closest_marker("django_db")
    return bool(marker and marker.kwargs.get("transaction"))


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return UserFactory()


@pytest.fixture
def other_user(db):
    return UserFactory()


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user)
    client.user = user
    return client


@pytest.fixture
def make_client(db):
    def _make(u=None):
        u = u or UserFactory()
        client = APIClient()
        client.force_authenticate(u)
        client.user = u
        return client

    return _make


@pytest.fixture
def lviv():
    return {"latitude": LVIV[0], "longitude": LVIV[1], "accuracy": 15}


@pytest.fixture
def s3(settings):
    from moto import mock_aws

    from apps.media import storage

    with mock_aws():
        storage.internal_client.cache_clear()
        storage.public_client.cache_clear()
        storage.ensure_bucket()
        yield storage
    storage.internal_client.cache_clear()
    storage.public_client.cache_clear()


@pytest.fixture
def no_push(monkeypatch):
    """Capture web push calls instead of hitting the network."""
    sent = []

    def fake_webpush(**kwargs):
        sent.append(kwargs)

    monkeypatch.setattr("apps.notifications.services.push.webpush", fake_webpush)
    return sent
