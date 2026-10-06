"""Google sign-in by full-page redirect (works in installed PWAs, where popups cannot report back).

    GET /api/v1/auth/google/start/?next=/help/123  → Google account chooser
    GET /api/v1/auth/google/callback/?code=…&state=… → session cookies → redirect to `next`

Register `<FRONTEND_URL>/api/v1/auth/google/callback/` under "Authorized redirect URIs"
of the OAuth client in Google Cloud Console.
"""

import secrets
from urllib.parse import urlencode

from django.conf import settings
from django.core import signing
from django.http import HttpRequest, HttpResponseRedirect
from django.views.decorators.http import require_GET

from apps.users.cookies import set_auth_cookies
from apps.users.services import accounts
from apps.users.services.tokens import issue_tokens
from common import analytics
from common.exceptions import DomainError

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
STATE_COOKIE = "poruch_google_state"
STATE_MAX_AGE = 10 * 60
STATE_SALT = "google-oauth-state"


def _callback_url() -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/api/v1/auth/google/callback/"


def _frontend(path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def _safe_next(value: str | None) -> str:
    """Only same-site paths: never redirect to another host after sign-in."""
    if value and value.startswith("/") and not value.startswith("//") and "\\" not in value:
        return value
    return "/"


@require_GET
def google_start(request: HttpRequest) -> HttpResponseRedirect:
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        return HttpResponseRedirect(_frontend("/auth/login?error=google"))
    state = secrets.token_urlsafe(24)
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": _callback_url(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    response = HttpResponseRedirect(f"{AUTHORIZE_URL}?{urlencode(params)}")
    # The state (anti-CSRF) and where to return are kept in a short-lived signed cookie.
    value = signing.dumps({"state": state, "next": _safe_next(request.GET.get("next"))}, salt=STATE_SALT)
    response.set_cookie(
        STATE_COOKIE,
        value,
        max_age=STATE_MAX_AGE,
        httponly=True,
        secure=request.is_secure(),
        samesite="Lax",  # sent on Google's top-level redirect back to us
        path="/api/v1/auth/google/",
    )
    return response


@require_GET
def google_callback(request: HttpRequest) -> HttpResponseRedirect:
    failure = HttpResponseRedirect(_frontend("/auth/login?error=google"))
    failure.delete_cookie(STATE_COOKIE, path="/api/v1/auth/google/")
    try:
        saved = signing.loads(request.COOKIES.get(STATE_COOKIE, ""), salt=STATE_SALT, max_age=STATE_MAX_AGE)
    except signing.BadSignature:
        return failure
    code = request.GET.get("code")
    if not code or not secrets.compare_digest(saved.get("state", ""), request.GET.get("state", "")):
        return failure  # cancelled in Google, expired, or forged
    try:
        credential = accounts.exchange_google_code(code, redirect_uri=_callback_url())
        user, created = accounts.authenticate_google(credential)
    except DomainError as exc:
        if exc.code == "ACCOUNT_INACTIVE":
            return HttpResponseRedirect(_frontend("/auth/login?error=inactive"))
        return failure
    analytics.track(user_id=user.id, event="user_logged_in", properties={"method": "google", "created": created})
    response = HttpResponseRedirect(_frontend(_safe_next(saved.get("next"))))
    response.delete_cookie(STATE_COOKIE, path="/api/v1/auth/google/")
    return set_auth_cookies(response, issue_tokens(user))
