"""App-wide «online now»: a short-lived mark refreshed by every authenticated API call.

The app polls every ~15 s while open, so someone counts as online for ONLINE_WINDOW seconds after
their last request. Cache only (Redis); not a source of business truth.
"""

from django.core.cache import cache

ONLINE_WINDOW = 70


def _key(user_id) -> str:
    return f"seen:{user_id}"


def touch(user_id) -> None:
    cache.set(_key(user_id), 1, timeout=ONLINE_WINDOW)


def is_online(user_id) -> bool:
    return bool(cache.get(_key(user_id)))
