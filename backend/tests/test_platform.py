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
    assert data["radii"] == [500, 1000, 3000, 5000, 10000, 20000, 30000]
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


@pytest.mark.django_db
def test_kpi_report(no_push):
    from django.core.management import call_command

    from apps.help_requests.management.commands.kpi_report import compute_kpis

    assert compute_kpis()["help_success_rate"] is None
    call_command("seed_demo_data")
    kpis = compute_kpis()
    assert kpis["requests_total"] == 5
    assert kpis["help_success_rate"] == 0.2
    assert kpis["response_rate"] == 0.6
    assert kpis["time_to_help_minutes"] is not None


def test_format_money_by_currency():
    from common.utils.money import format_money

    assert format_money(500, "UAH") == "500 грн"
    assert format_money(10, "EUR") == "10 €"
    assert format_money(12, "USD") == "$12"
    assert format_money("12.50", "GBP") == "£12.5"


def test_service_email_is_multipart_with_reply_to_and_absolute_links(settings, django_capture_on_commit_callbacks):
    from django.core import mail

    from common.emails import send_service_email

    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.FRONTEND_URL = "https://poruch.test"
    settings.SUPPORT_EMAIL = "support@poruch.test"
    with django_capture_on_commit_callbacks(execute=True):
        send_service_email(
            "user@example.com",
            "Нове повідомлення",
            heading="Нове повідомлення",
            paragraphs=["Вам написали в чаті"],
            button_text="Відкрити",
            button_url="/chats/42",
        )
    sent = mail.outbox[-1]
    assert sent.reply_to == ["support@poruch.test"]
    assert "https://poruch.test/chats/42" in sent.body  # relative links do not work in mail
    html, mime = sent.alternatives[0]
    assert mime == "text/html" and 'href="https://poruch.test/chats/42"' in html
