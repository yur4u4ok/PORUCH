from rest_framework.permissions import BasePermission


class IsVerifiedUser(BasePermission):
    """Authenticated, active user with a verified email."""

    message = "Email address must be verified."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.is_active and getattr(user, "email_verified", False))


class IsAuthenticatedUser(BasePermission):
    """Authenticated user; email verification not required (e.g. /me, verify-email)."""

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated and request.user.is_active)
