"""Simple fixed-window counters on top of the Django cache (Redis in production)."""

from django.core.cache import cache


def hit(key: str, limit: int, window_seconds: int) -> bool:
    """Register a hit; return True if still within the limit."""
    cache_key = f"rl:{key}"
    added = cache.add(cache_key, 1, timeout=window_seconds)
    if added:
        return limit >= 1
    try:
        current = cache.incr(cache_key)
    except ValueError:
        cache.set(cache_key, 1, timeout=window_seconds)
        current = 1
    return current <= limit


def peek(key: str) -> int:
    return int(cache.get(f"rl:{key}") or 0)
