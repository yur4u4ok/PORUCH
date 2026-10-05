from celery import shared_task

from apps.help_requests.services.lifecycle import expire_help_requests as _expire


@shared_task
def expire_help_requests() -> int:
    return _expire()
