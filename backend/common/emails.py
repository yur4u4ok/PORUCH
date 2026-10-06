"""Service emails: one branded HTML layout plus a plain-text version of the same content.

Multipart (text + HTML), a real From name and Reply-To to support are signals mail providers use
to tell transactional mail from spam; links are absolute (emails cannot follow "/chats/…").
"""

from django.conf import settings
from django.db import transaction
from django.template.loader import render_to_string


def absolute_url(path_or_url: str) -> str:
    if path_or_url.startswith(("http://", "https://")):
        return path_or_url
    return f"{settings.FRONTEND_URL.rstrip('/')}/{path_or_url.lstrip('/')}"


def send_service_email(
    to: str,
    subject: str,
    *,
    heading: str,
    paragraphs: list[str],
    button_text: str = "",
    button_url: str = "",
    note: str = "",
    preheader: str = "",
    on_commit: bool = True,
) -> None:
    from apps.users.tasks import send_email

    button_url = absolute_url(button_url) if button_url else ""
    context = {
        "subject": subject,
        "heading": heading,
        "paragraphs": paragraphs,
        "button_text": button_text,
        "button_url": button_url,
        "note": note,
        "preheader": preheader or (paragraphs[0] if paragraphs else heading),
        "site_url": settings.FRONTEND_URL.rstrip("/"),
    }
    html = render_to_string("emails/base.html", context)
    text_parts = [heading, *paragraphs]
    if button_url:
        text_parts.append(f"{button_text}: {button_url}")
    if note:
        text_parts.append(note)
    text_parts.append("—\nPoruch · " + context["site_url"])
    text = "\n\n".join(text_parts)

    def queue() -> None:
        send_email.delay(to, subject, text, html)

    transaction.on_commit(queue) if on_commit else queue()
