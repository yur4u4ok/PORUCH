from celery import shared_task

from apps.notifications.services import push


@shared_task(autoretry_for=(ConnectionError,), retry_backoff=True, max_retries=3)
def send_nearby_help_notifications(help_request_id: str) -> int:
    from apps.help_requests.models import HelpRequest
    from apps.notifications.services.nearby_notifications import notify_users_about_help_request

    help_request = HelpRequest.objects.filter(id=help_request_id).first()
    if help_request is None:
        return 0
    return notify_users_about_help_request(help_request)


@shared_task(autoretry_for=(ConnectionError,), retry_backoff=True, max_retries=3)
def send_push_notification(notification_id: str) -> int:
    return push.deliver(notification_id)


@shared_task
def cleanup_invalid_push_subscriptions() -> int:
    return push.cleanup_invalid_subscriptions()
