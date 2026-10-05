from datetime import timedelta

import factory
from django.utils import timezone

from apps.help_requests.constants import Category, RewardType, Urgency
from apps.help_requests.models import HelpRequest
from apps.interactions.models import HelpResponse
from apps.notifications.models import NotificationPreference, PushSubscription
from apps.users.models import Profile, User
from common.utils.geo import make_point

# Lviv city centre (test fixture data only)
LVIV = (49.8429, 24.0316)


def offset_point(lat: float, lng: float, north_m: float = 0, east_m: float = 0):
    """Approximate point shifted by meters (good enough for tests)."""
    import math

    dlat = north_m / 111_320
    dlng = east_m / (111_320 * math.cos(math.radians(lat)))
    return lat + dlat, lng + dlng


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    email_verified = True
    password = factory.PostGenerationMethodCall("set_password", "Str0ng-pass!")

    @factory.post_generation
    def with_profile(obj, create, extracted, **kwargs):
        if not create:
            return
        obj.save()
        Profile.objects.get_or_create(user=obj, defaults={"display_name": obj.email.split("@")[0]})
        NotificationPreference.objects.get_or_create(user=obj)


class HelpRequestFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = HelpRequest

    author = factory.SubFactory(UserFactory)
    category = Category.AUTO
    title = "Пробите колесо"
    description = "Пробив колесо, потрібен домкрат"
    location = factory.LazyFunction(lambda: make_point(*LVIV))
    urgency = Urgency.NOW
    reward_type = RewardType.NONE
    expires_at = factory.LazyFunction(lambda: timezone.now() + timedelta(hours=6))


class HelpResponseFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = HelpResponse

    help_request = factory.SubFactory(HelpRequestFactory)
    helper = factory.SubFactory(UserFactory)
    message = "Можу допомогти"


class PushSubscriptionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PushSubscription

    user = factory.SubFactory(UserFactory)
    endpoint = factory.Sequence(lambda n: f"https://push.example.com/sub/{n}")
    p256dh = "p256dh-key"
    auth = "auth-secret"
