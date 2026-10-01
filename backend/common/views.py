from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.help_requests.constants import NOTIFICATION_CATEGORIES, SUBCATEGORIES, Category, Urgency
from apps.users.models import Capability


class PublicConfigView(APIView):
    """Runtime configuration for the frontend (no secrets)."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(responses={200: dict})
    def get(self, request):
        return Response(
            {
                "vapid_public_key": settings.VAPID_PUBLIC_KEY,
                "google_client_id": settings.GOOGLE_CLIENT_ID,
                "categories": [c.value for c in Category],
                "subcategories": {str(k): v for k, v in SUBCATEGORIES.items()},
                "notification_categories": [c.value for c in NOTIFICATION_CATEGORIES],
                "urgencies": [u.value for u in Urgency],
                "radii": settings.NEARBY_ALLOWED_RADII,
                "default_radius": settings.NEARBY_DEFAULT_RADIUS,
                "max_photos": settings.HELP_REQUEST_MAX_PHOTOS,
                "max_upload_bytes": settings.MEDIA_MAX_UPLOAD_BYTES,
                "allowed_image_types": settings.MEDIA_ALLOWED_CONTENT_TYPES,
                "availability_default_minutes": settings.AVAILABILITY_DEFAULT_HOURS * 60,
                "capabilities": list(
                    Capability.objects.filter(is_active=True).values("code", "kind", "category", "emoji")
                ),
            }
        )
