from celery import shared_task

from apps.media.services.media import cleanup_expired_media as _cleanup


@shared_task
def cleanup_expired_media() -> int:
    return _cleanup()
