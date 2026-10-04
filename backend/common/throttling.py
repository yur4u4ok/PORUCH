"""DRF throttles. Rates are configured in settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']."""

from rest_framework.throttling import SimpleRateThrottle


class IPScopedThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class UserScopedThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = str(request.user.pk)
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class LoginThrottle(IPScopedThrottle):
    scope = "login"


class RegisterThrottle(IPScopedThrottle):
    scope = "register"


class PasswordResetThrottle(IPScopedThrottle):
    scope = "password_reset"


class CreateHelpRequestThrottle(UserScopedThrottle):
    scope = "create_help_request"


class RespondThrottle(UserScopedThrottle):
    scope = "respond"


class MessagesThrottle(UserScopedThrottle):
    scope = "messages"


class ReportsThrottle(UserScopedThrottle):
    scope = "reports"


class SupportThrottle(UserScopedThrottle):
    scope = "support"


class SharePreviewThrottle(IPScopedThrottle):
    scope = "share_preview"


class MediaUploadThrottle(UserScopedThrottle):
    scope = "media_upload"
