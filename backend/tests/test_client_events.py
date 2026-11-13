import pytest

from common.models import AnalyticsEvent

URL = "/api/v1/events/"


@pytest.mark.django_db
def test_client_event_is_recorded_without_personal_data(api_client):
    assert api_client.post(URL, {"event": "landing_view", "origin": "landing"}, format="json").status_code == 204
    event = AnalyticsEvent.objects.get(event="landing_view")
    assert event.user_id is None and event.properties == {"origin": "landing"}


@pytest.mark.django_db
def test_unknown_events_and_extra_fields_are_rejected(api_client):
    assert api_client.post(URL, {"event": "anything_else"}, format="json").status_code == 400
    api_client.post(URL, {"event": "login_started", "email": "a@b.c", "lat": 50.4}, format="json")
    assert AnalyticsEvent.objects.get(event="login_started").properties == {}
