from drf_spectacular.utils import extend_schema
from rest_framework.generics import ListAPIView

from apps.moderation.selectors import is_blocked_between
from apps.reputation.models import Review, ThankYou
from apps.reputation.serializers import ReviewSerializer, ThankYouSerializer
from apps.users.models import User
from common.exceptions import NotFound


class UserThanksView(ListAPIView):
    serializer_class = ThankYouSerializer

    @extend_schema(responses=ThankYouSerializer(many=True))
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        user = User.objects.filter(pk=self.kwargs["user_id"]).first()
        if user is None or (user.pk != self.request.user.pk and is_blocked_between(self.request.user, user)):
            raise NotFound()
        return ThankYou.objects.filter(to_user=user).select_related("help_request", "from_user__profile__avatar")


class UserReviewsView(ListAPIView):
    """Reviews a person received. Read-only: there is no way to edit or delete them through the API."""

    serializer_class = ReviewSerializer

    @extend_schema(responses=ReviewSerializer(many=True))
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        user = User.objects.filter(pk=self.kwargs["user_id"]).first()
        if user is None or (user.pk != self.request.user.pk and is_blocked_between(self.request.user, user)):
            raise NotFound()
        return Review.objects.filter(to_user=user).select_related("help_request", "from_user__profile__avatar")
