from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMessage


@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def send_support_email(subject: str, body: str, reply_to: str) -> None:
    EmailMessage(subject, body, None, [settings.SUPPORT_EMAIL], reply_to=[reply_to]).send()
