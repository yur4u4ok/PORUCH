from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives


@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def send_email(to: str, subject: str, body: str, html: str | None = None) -> None:
    message = EmailMultiAlternatives(
        subject,
        body,
        None,  # DEFAULT_FROM_EMAIL, e.g. "Poruch <no-reply@…>"
        [to],
        reply_to=[settings.SUPPORT_EMAIL] if settings.SUPPORT_EMAIL else None,
    )
    if html:
        message.attach_alternative(html, "text/html")
    message.send()
