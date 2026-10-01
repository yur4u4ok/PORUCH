import pytest


@pytest.mark.django_db
def test_health(client):
    assert client.get("/health/live/").json() == {"status": "ok"}
    ready = client.get("/health/ready/")
    assert ready.status_code == 200
    assert ready.json()["checks"] == {"postgres": "ok", "redis": "ok"}


@pytest.mark.django_db
def test_error_format_and_auth_required(api_client):
    response = api_client.get("/api/v1/me/")
    assert response.status_code == 401
    assert set(response.json()) == {"code", "message", "details"}
    assert response.json()["code"] == "NOT_AUTHENTICATED"


@pytest.mark.django_db
def test_public_config(api_client):
    data = api_client.get("/api/v1/config/").json()
    assert data["vapid_public_key"] == "test-public"
    assert data["radii"] == [500, 1000, 3000, 5000, 10000]
    assert any(c["code"] == "AUTO_TIRE" for c in data["capabilities"])


@pytest.mark.django_db
def test_openapi_schema(api_client, settings):
    response = api_client.get("/api/schema/")
    assert response.status_code in (200, 401, 403)


@pytest.mark.django_db
def test_analytics_events_recorded(make_client, lviv):
    from common.models import AnalyticsEvent

    make_client().post(
        "/api/v1/help-requests/",
        {"category": "AUTO", "description": "x", "location": lviv, "urgency": "NOW"},
        format="json",
    )
    assert AnalyticsEvent.objects.filter(event="help_requests_created").exists()


@pytest.mark.django_db
def test_seed_demo_data(no_push):
    from django.core.management import call_command

    from apps.help_requests.models import HelpRequest
    from apps.reputation.models import ThankYou

    call_command("seed_demo_data")
    assert HelpRequest.objects.filter(status="COMPLETED").count() == 1
    assert HelpRequest.objects.filter(status="IN_PROGRESS").count() == 1
    assert ThankYou.objects.count() == 1
    call_command("seed_demo_data", "--reset")
    assert HelpRequest.objects.count() == 5
