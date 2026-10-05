from django.conf import settings
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken


def _cookie_kwargs() -> dict:
    return {
        "secure": settings.AUTH_COOKIE_SECURE,
        "httponly": True,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
        "domain": settings.AUTH_COOKIE_DOMAIN,
    }


def set_auth_cookies(response: Response, refresh: RefreshToken) -> Response:
    jwt = settings.SIMPLE_JWT
    response.set_cookie(
        settings.AUTH_COOKIE_ACCESS,
        str(refresh.access_token),
        max_age=int(jwt["ACCESS_TOKEN_LIFETIME"].total_seconds()),
        path="/",
        **_cookie_kwargs(),
    )
    response.set_cookie(
        settings.AUTH_COOKIE_REFRESH,
        str(refresh),
        max_age=int(jwt["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        path=settings.AUTH_COOKIE_REFRESH_PATH,
        **_cookie_kwargs(),
    )
    return response


def clear_auth_cookies(response: Response) -> Response:
    response.delete_cookie(
        settings.AUTH_COOKIE_ACCESS,
        path="/",
        domain=settings.AUTH_COOKIE_DOMAIN,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        settings.AUTH_COOKIE_REFRESH,
        path=settings.AUTH_COOKIE_REFRESH_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    return response
