from celery import shared_task

from apps.locations.services.availability import expire_availability as _expire


@shared_task
def expire_availability() -> int:
    return _expire()
