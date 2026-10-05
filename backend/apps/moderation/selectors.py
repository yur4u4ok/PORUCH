from django.db.models import Q

from apps.moderation.models import UserBlock


def blocked_user_ids(user) -> set:
    """Users blocked by `user` or who blocked `user` (blocking is symmetric in effect)."""
    if not getattr(user, "is_authenticated", False):
        return set()
    rows = UserBlock.objects.filter(Q(blocker=user) | Q(blocked=user)).values_list("blocker_id", "blocked_id")
    ids = {uid for pair in rows for uid in pair}
    ids.discard(user.pk)
    return ids


def is_blocked_between(a, b) -> bool:
    return UserBlock.objects.filter(Q(blocker=a, blocked=b) | Q(blocker=b, blocked=a)).exists()
