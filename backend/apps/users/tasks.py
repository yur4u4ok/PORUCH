from celery import shared_task
from django.core.mail import send_mail


@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def send_email(to: str, subject: str, body: str) -> None:
    send_mail(subject, body, None, [to])
