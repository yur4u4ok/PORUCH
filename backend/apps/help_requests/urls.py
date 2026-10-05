from rest_framework.routers import SimpleRouter

from apps.help_requests.views import HelpRequestViewSet
from apps.interactions.views import HelpResponseViewSet

router = SimpleRouter()
router.register("help-requests", HelpRequestViewSet, basename="help-request")
router.register("help-responses", HelpResponseViewSet, basename="help-response")

urlpatterns = router.urls
