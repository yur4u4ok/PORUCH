"""Authenticate WebSocket connections using the HttpOnly access cookie."""

from http.cookies import SimpleCookie

from channels.db import database_sync_to_async
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def _get_user(raw_token: str):
    from apps.users.models import User

    try:
        token = AccessToken(raw_token)  # type: ignore[arg-type]
        return User.objects.get(id=token["user_id"], is_active=True)
    except (InvalidToken, TokenError, User.DoesNotExist, KeyError):
        return AnonymousUser()


class CookieJWTAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        cookies: dict[str, str] = {}
        for name, value in scope.get("headers", []):
            if name == b"cookie":
                parsed = SimpleCookie()
                parsed.load(value.decode("latin1"))
                cookies.update({k: m.value for k, m in parsed.items()})
        raw = cookies.get(settings.AUTH_COOKIE_ACCESS)
        scope["user"] = await _get_user(raw) if raw else AnonymousUser()
        return await self.inner(scope, receive, send)
