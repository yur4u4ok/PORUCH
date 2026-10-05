"""Lightweight presence tracking in the cache (Redis). Not a source of business truth."""

from django.conf import settings
from django.core.cache import cache


def _key(conversation_id, user_id) -> str:
    return f"presence:{conversation_id}:{user_id}"


def connect(conversation_id, user_id) -> None:
    key = _key(conversation_id, user_id)
    if not cache.add(key, 1, timeout=settings.PRESENCE_TTL_SECONDS):
        try:
            cache.incr(key)
        except ValueError:
            cache.set(key, 1, timeout=settings.PRESENCE_TTL_SECONDS)
        cache.touch(key, settings.PRESENCE_TTL_SECONDS)


def heartbeat(conversation_id, user_id) -> None:
    key = _key(conversation_id, user_id)
    if not cache.touch(key, settings.PRESENCE_TTL_SECONDS):
        cache.set(key, 1, timeout=settings.PRESENCE_TTL_SECONDS)


def disconnect(conversation_id, user_id) -> bool:
    """Returns True when the user has no more open connections to this conversation."""
    key = _key(conversation_id, user_id)
    try:
        remaining = cache.decr(key)
    except ValueError:
        return True
    if remaining <= 0:
        cache.delete(key)
        return True
    return False


def is_online(conversation_id, user_id) -> bool:
    return bool(cache.get(_key(conversation_id, user_id)))
