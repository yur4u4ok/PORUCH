from django.conf import settings
from django.contrib import admin
from django.urls import URLPattern, URLResolver, include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny, BasePermission, IsAdminUser

from apps.users.authentication import CookieJWTAuthentication
from apps.users.urls import auth_urlpatterns
from common import health
from common.views import PublicConfigView

docs_auth = [SessionAuthentication, CookieJWTAuthentication]
docs_permission: list[type[BasePermission]] = [AllowAny] if settings.API_DOCS_PUBLIC else [IsAdminUser]

api_v1: list[URLPattern | URLResolver] = [
    path("auth/", include(auth_urlpatterns)),
    path("config/", PublicConfigView.as_view(), name="config"),
    path("", include("apps.users.urls")),
    path("", include("apps.locations.urls")),
    path("", include("apps.help_requests.urls")),
    path("", include("apps.conversations.urls")),
    path("", include("apps.notifications.urls")),
    path("", include("apps.media.urls")),
    path("", include("apps.reputation.urls")),
    path("", include("apps.moderation.urls")),
]

urlpatterns = [
    path("api/v1/", include(api_v1)),
    path(
        "api/schema/",
        SpectacularAPIView.as_view(permission_classes=docs_permission, authentication_classes=docs_auth),
        name="schema",
    ),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(
            url_name="schema", permission_classes=docs_permission, authentication_classes=docs_auth
        ),
        name="swagger-ui",
    ),
    path("health/live/", health.live, name="health-live"),
    path("health/ready/", health.ready, name="health-ready"),
    path("admin/", admin.site.urls),
]

admin.site.site_header = "Поруч — адміністрування"
admin.site.site_title = "Поруч"
