import pytest
from django.test import Client

from common.models import AnalyticsEvent
from tests.factories import HelpRequestFactory, UserFactory

pytestmark = pytest.mark.django_db


def test_share_url_in_detail_for_active_only(make_client, settings):
    settings.SHARE_BASE_URL = "https://poruch.app"
    hr = HelpRequestFactory()
    data = make_client().get(f"/api/v1/help-requests/{hr.id}/").data
    assert data["share_url"] == f"https://poruch.app/r/{hr.share_code}"
    hr.status = "CANCELLED"
    hr.save()
    assert make_client().get(f"/api/v1/help-requests/{hr.id}/").data["share_url"] is None


def test_public_preview_without_login_hides_private_data(api_client):
    hr = HelpRequestFactory(reward_type="WILLING", reward_amount=500, reward_options=["PIZZA"])
    response = api_client.get(f"/api/v1/share/{hr.share_code}/")
    assert response.status_code == 200
    data = response.json()
    assert data["active"] is True and data["title"] == hr.title
    assert data["reward_amount"] == "500.00" and data["reward_options"] == ["PIZZA"]
    assert data["place"] == "" and data["reward_currency"] == "UAH"
    # never exposed publicly
    for private in ("author", "location", "photos", "distance_m", "email"):
        assert private not in data
    assert AnalyticsEvent.objects.filter(event="share_link_opened").exists()


def test_closed_request_preview_has_no_details(api_client):
    hr = HelpRequestFactory(status="COMPLETED", selected_helper=UserFactory())
    data = api_client.get(f"/api/v1/share/{hr.share_code}/").json()
    assert data["active"] is False and data["title"] is None and data["description"] is None


def test_unknown_code_and_inactive_author_are_404(api_client):
    assert api_client.get("/api/v1/share/nope/").status_code == 404
    hr = HelpRequestFactory()
    hr.author.is_active = False
    hr.author.save()
    assert api_client.get(f"/api/v1/share/{hr.share_code}/").status_code == 404


def test_short_link_renders_open_graph_and_redirects(settings):
    settings.FRONTEND_URL = "https://poruch.app"
    hr = HelpRequestFactory(title="Пробите колесо", reward_type="WILLING", reward_amount=500, place_name="Львів")
    html = Client().get(f"/r/{hr.share_code}").content.decode()
    assert 'property="og:title" content="Потрібна допомога: Пробите колесо"' in html
    assert "500 грн" in html and "Львів" in html
    assert f"https://poruch.app/share/{hr.share_code}" in html
    assert 'property="og:image" content="https://poruch.app/og-image.png"' in html
    assert 'name="robots" content="noindex, nofollow"' in html


def test_share_codes_are_unique():
    codes = {HelpRequestFactory().share_code for _ in range(20)}
    assert len(codes) == 20


def test_preview_uses_request_place_and_currency(api_client):
    hr = HelpRequestFactory(reward_type="WILLING", reward_amount=12, reward_currency="USD", place_name="Austin")
    data = api_client.get(f"/api/v1/share/{hr.share_code}/").json()
    assert data["place"] == "Austin" and data["reward_currency"] == "USD"
    html = api_client.get(f"/r/{hr.share_code}").content.decode()
    assert "Austin" in html and "$12" in html
