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
        reverse("auth-register"), {"email": email, "password": password, "display_name": "Остап"}, format="json"
    )


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
