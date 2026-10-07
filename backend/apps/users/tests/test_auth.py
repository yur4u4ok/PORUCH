import re
from unittest import mock
from urllib.parse import unquote

import pytest
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from apps.notifications.models import NotificationPreference
from apps.users.models import Profile, SocialAccount, User
from apps.users.services.accounts import make_email_verification_token
from tests.factories import UserFactory

pytestmark = pytest.mark.django_db

PASSWORD = "Very-strong-Pa55"


def register(client, email="new@example.com", password=PASSWORD):
    return client.post(
        reverse("auth-register"),
        {
            "email": email,
            "password": password,
            "display_name": "Остап",
            "phone": "067 123 45 67",
            "age_confirmed": True,
        },
        format="json",
    )


def test_register_requires_age_confirmation(api_client):
    response = api_client.post(
        reverse("auth-register"),
        {"email": "young@example.com", "password": PASSWORD, "display_name": "Юний", "age_confirmed": False},
        format="json",
    )
    assert response.status_code == 400 and "age_confirmed" in response.data["details"]
    assert not User.objects.filter(email="young@example.com").exists()


def test_register_creates_user_profile_preferences_and_sends_email(api_client):
    response = register(api_client)
    assert response.status_code == 201, response.data
    user = User.objects.get(email="new@example.com")
    assert not user.email_verified
    assert Profile.objects.get(user=user).display_name == "Остап"
    assert Profile.objects.get(user=user).city is None  # no implicit default city
    assert NotificationPreference.objects.filter(user=user).exists()
    assert len(mail.outbox) == 1
    assert "/auth/verify-email?token=" in mail.outbox[0].body
    assert "poruch_access" in response.cookies
    assert response.cookies["poruch_access"]["httponly"]


def test_register_duplicate_email_is_conflict(api_client, user):
    response = register(api_client, email=user.email.upper())
    assert response.status_code == 409
    assert response.data["code"] == "EMAIL_TAKEN"


def test_register_weak_password(api_client):
    response = register(api_client, password="12345678")
    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert "password" in response.data["details"]


def test_unverified_user_cannot_use_core_api_but_can_read_me(api_client):
    register(api_client)
    client = APIClient()
    client.force_authenticate(User.objects.get(email="new@example.com"))
    assert client.get(reverse("me")).status_code == 200
    assert client.get("/api/v1/help-requests/?lat=49.84&lng=24.03").status_code == 403


def test_verify_email(api_client):
    register(api_client)
    user = User.objects.get(email="new@example.com")
    token = unquote(re.search(r"token=([^\s]+)", mail.outbox[0].body).group(1))
    response = api_client.post(reverse("auth-verify-email"), {"token": token}, format="json")
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.email_verified


def test_verify_email_invalid_token(api_client):
    response = api_client.post(reverse("auth-verify-email"), {"token": "garbage"}, format="json")
    assert response.status_code == 400
    assert response.data["code"] == "TOKEN_INVALID"


def test_login_sets_cookies_and_cookie_auth_works_with_csrf():
    user = UserFactory(email="login@example.com")
    client = APIClient(enforce_csrf_checks=True)
    client.get(reverse("auth-csrf"))
    response = client.post(
        reverse("auth-login"), {"email": "LOGIN@example.com", "password": "Str0ng-pass!"}, format="json"
    )
    assert response.status_code == 200
    assert response.data["id"] == str(user.id)
    # Cookie-authenticated GET works
    assert client.get(reverse("me")).status_code == 200
    # Unsafe request without CSRF header is rejected
    assert client.patch(reverse("me"), {"display_name": "X"}, format="json").status_code == 403
    csrf = client.cookies["csrftoken"].value
    ok = client.patch(reverse("me"), {"display_name": "X"}, format="json", HTTP_X_CSRFTOKEN=csrf)
    assert ok.status_code == 200
    assert ok.data["display_name"] == "X"


def test_login_wrong_password(api_client, user):
    response = api_client.post(reverse("auth-login"), {"email": user.email, "password": "nope"}, format="json")
    assert response.status_code == 400
    assert response.data["code"] == "INVALID_CREDENTIALS"


def test_refresh_rotates_and_logout_clears(api_client, user):
    api_client.post(reverse("auth-login"), {"email": user.email, "password": "Str0ng-pass!"}, format="json")
    old_refresh = api_client.cookies["poruch_refresh"].value
    response = api_client.post(reverse("auth-refresh"))
    assert response.status_code == 204
    assert api_client.cookies["poruch_refresh"].value != old_refresh
    # Old refresh token is blacklisted
    api_client.cookies["poruch_refresh"] = old_refresh
    assert api_client.post(reverse("auth-refresh")).status_code == 401
    response = api_client.post(reverse("auth-logout"))
    assert response.status_code == 204
    assert response.cookies["poruch_access"].value == ""


def test_password_reset_flow(api_client, user):
    assert api_client.post(reverse("auth-password-reset"), {"email": user.email}, format="json").status_code == 204
    body = mail.outbox[-1].body
    uid = re.search(r"uid=([^&\s]+)", body).group(1)
    token = re.search(r"token=([^&\s]+)", body).group(1)
    response = api_client.post(
        reverse("auth-password-reset-confirm"), {"uid": uid, "token": token, "password": PASSWORD}, format="json"
    )
    assert response.status_code == 204
    user.refresh_from_db()
    assert user.check_password(PASSWORD)
    # token is single-use
    again = api_client.post(
        reverse("auth-password-reset-confirm"), {"uid": uid, "token": token, "password": PASSWORD + "x"}, format="json"
    )
    assert again.status_code == 400


def test_password_reset_unknown_email_does_not_leak(api_client):
    assert api_client.post(reverse("auth-password-reset"), {"email": "nobody@x.com"}, format="json").status_code == 204
    assert len(mail.outbox) == 0


def test_google_auth_creates_verified_user(api_client, settings):
    settings.GOOGLE_CLIENT_ID = "client-id"
    claims = {"sub": "g-123", "email": "g@example.com", "email_verified": True, "given_name": "Галя"}
    with mock.patch("apps.users.services.accounts._verify_google_credential", return_value=claims):
        response = api_client.post(reverse("auth-google"), {"credential": "x"}, format="json")
        assert response.status_code == 201
        again = api_client.post(reverse("auth-google"), {"credential": "x"}, format="json")
        assert again.status_code == 200
    user = User.objects.get(email="g@example.com")
    assert user.email_verified and not user.has_usable_password()
    assert SocialAccount.objects.filter(user=user, provider="google", uid="g-123").count() == 1


def test_email_verification_token_for_other_email_is_invalid(user, api_client):
    token = make_email_verification_token(user)
    user.email = "changed@example.com"
    user.save()
    assert api_client.post(reverse("auth-verify-email"), {"token": token}, format="json").status_code == 400


def test_login_rate_limited(api_client, settings, user):
    for _ in range(5):
        api_client.post(reverse("auth-login"), {"email": user.email, "password": "bad"}, format="json")
    response = api_client.post(reverse("auth-login"), {"email": user.email, "password": "bad"}, format="json")
    assert response.status_code == 429
    assert response.data["code"] == "RATE_LIMITED"


def test_google_popup_code_is_exchanged_for_id_token(api_client, settings):
    settings.GOOGLE_CLIENT_ID = "client-id"
    settings.GOOGLE_CLIENT_SECRET = "secret"
    claims = {"sub": "g-777", "email": "popup@example.com", "email_verified": True, "given_name": "Popup"}
    token_response = mock.Mock(ok=True, json=lambda: {"id_token": "id-token"})
    with (
        mock.patch("requests.post", return_value=token_response) as post,
        mock.patch("apps.users.services.accounts._verify_google_credential", return_value=claims) as verify,
    ):
        response = api_client.post(reverse("auth-google"), {"code": "one-time"}, format="json")
    assert response.status_code == 201
    assert post.call_args.kwargs["data"]["redirect_uri"] == "postmessage"
    verify.assert_called_once_with("id-token")


def test_google_auth_requires_credential_or_code(api_client):
    assert api_client.post(reverse("auth-google"), {}, format="json").status_code == 400


class TestGoogleRedirectFlow:
    """Full-page redirect sign-in (installed PWAs cannot use the popup)."""

    @pytest.fixture(autouse=True)
    def google(self, settings):
        settings.GOOGLE_CLIENT_ID = "client-id"
        settings.GOOGLE_CLIENT_SECRET = "secret"
        settings.FRONTEND_URL = "https://poruch.test"

    def start(self, client, next_path="/help/42"):
        response = client.get("/api/v1/auth/google/start/", {"next": next_path})
        assert response.status_code == 302 and response["Location"].startswith("https://accounts.google.com/")
        from urllib.parse import parse_qs, urlparse

        query = parse_qs(urlparse(response["Location"]).query)
        assert query["redirect_uri"] == ["https://poruch.test/api/v1/auth/google/callback/"]
        return query["state"][0]

    def test_callback_signs_in_and_returns_to_next(self, client):
        state = self.start(client)
        claims = {"sub": "g-900", "email": "pwa@example.com", "email_verified": True, "given_name": "Pwa"}
        with (
            mock.patch("apps.users.services.accounts.exchange_google_code", return_value="id-token") as exchange,
            mock.patch("apps.users.services.accounts._verify_google_credential", return_value=claims),
        ):
            response = client.get("/api/v1/auth/google/callback/", {"code": "c", "state": state})
        assert response.status_code == 302 and response["Location"] == "https://poruch.test/help/42"
        assert exchange.call_args.kwargs["redirect_uri"] == "https://poruch.test/api/v1/auth/google/callback/"
        assert len(settings_cookie_names(response)) == 2  # access + refresh cookies set
        assert User.objects.filter(email="pwa@example.com").exists()

    def test_forged_state_is_rejected(self, client):
        self.start(client)
        response = client.get("/api/v1/auth/google/callback/", {"code": "c", "state": "forged"})
        assert response["Location"] == "https://poruch.test/auth/login?error=google"

    def test_next_cannot_point_to_another_site(self, client):
        state = self.start(client, next_path="//evil.example/steal")
        claims = {"sub": "g-901", "email": "x@example.com", "email_verified": True}
        with (
            mock.patch("apps.users.services.accounts.exchange_google_code", return_value="t"),
            mock.patch("apps.users.services.accounts._verify_google_credential", return_value=claims),
        ):
            response = client.get("/api/v1/auth/google/callback/", {"code": "c", "state": state})
        assert response["Location"] == "https://poruch.test/"


def settings_cookie_names(response):
    from django.conf import settings

    return {name for name in response.cookies if name in (settings.AUTH_COOKIE_ACCESS, settings.AUTH_COOKIE_REFRESH)}


class TestContacts:
    def test_phone_is_normalized_and_encrypted_at_rest(self, api_client):
        response = register(api_client, email="phone@example.com")
        assert response.data["phone"] == "+380671234567"
        user = User.objects.get(email="phone@example.com")
        assert "380671234567" not in user.phone_encrypted  # not stored in clear text
        assert user.phone_hash

    def test_invalid_phone_rejected(self, api_client):
        response = api_client.post(
            reverse("auth-register"),
            {"email": "x@example.com", "password": PASSWORD, "display_name": "X", "phone": "12", "age_confirmed": True},
            format="json",
        )
        assert response.status_code == 400 and "phone" in response.data["details"]

    def test_change_phone_in_profile(self, auth_client):
        response = auth_client.patch(reverse("me"), {"phone": "+48 512 345 678"}, format="json")
        assert response.status_code == 200 and response.data["phone"] == "+48512345678"
        response = auth_client.patch(reverse("me"), {"phone": ""}, format="json")
        assert response.data["phone"] is None

    def test_email_changes_only_after_confirming_new_inbox(self, auth_client, user):
        user.set_password(PASSWORD)
        user.save()
        response = auth_client.post(
            reverse("me-email"), {"email": "wrong@example.com", "password": "nope"}, format="json"
        )
        assert response.status_code == 400
        response = auth_client.post(
            reverse("me-email"), {"email": "New@Example.com", "password": PASSWORD}, format="json"
        )
        assert response.status_code == 200 and response.data["pending_email"] == "new@example.com"
        user.refresh_from_db()
        assert user.email != "new@example.com"  # not yet
        assert mail.outbox[-1].to == ["new@example.com"]
        token = unquote(re.search(r"token=([^\s\"&]+)", mail.outbox[-1].body).group(1))
        api_client = APIClient()
        assert api_client.post(reverse("auth-verify-email"), {"token": token}, format="json").status_code == 200
        user.refresh_from_db()
        assert user.email == "new@example.com" and user.pending_email == ""
