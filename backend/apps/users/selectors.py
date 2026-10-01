from django.db.models import QuerySet

from apps.users.models import User


def users_with_profile() -> QuerySet[User]:
    return User.objects.select_related("profile", "profile__avatar")
