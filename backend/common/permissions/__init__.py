from rest_framework.permissions import BasePermission


def _seen(user) -> None:
    """Every authenticated call marks the user as online (see common/presence.py)."""
    from common import presence

    presence.touch(user.pk)


class IsVerifiedUser(BasePermission):
    """Authenticated, active user with a verified email."""

    message = "Email address must be verified."

    def has_permission(self, request, view) -> bool:
        user = request.user
        allowed = bool(user and user.is_authenticated and user.is_active and getattr(user, "email_verified", False))
        if allowed:
            _seen(user)
        return allowed


class IsAuthenticatedUser(BasePermission):
    """Authenticated user; email verification not required (e.g. /me, verify-email)."""

    def has_permission(self, request, view) -> bool:
        allowed = bool(request.user and request.user.is_authenticated and request.user.is_active)
        if allowed:
            _seen(request.user)
        return allowed
