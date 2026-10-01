import logging
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.media import storage
from apps.media.models import Media
from apps.media.services.images import process_image
from apps.users.models import User
from common.exceptions import Forbidden, InvalidState, NotFound, ValidationFailed

logger = logging.getLogger(__name__)

EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def create_upload(user: User, *, kind: str, content_type: str, size: int) -> tuple[Media, dict]:
    if content_type not in settings.MEDIA_ALLOWED_CONTENT_TYPES:
        raise ValidationFailed(details={"content_type": [_("Дозволені формати: JPEG, PNG, WEBP.")]})
    if size <= 0 or size > settings.MEDIA_MAX_UPLOAD_BYTES:
        max_mb = settings.MEDIA_MAX_UPLOAD_BYTES // (1024 * 1024)
        raise ValidationFailed(details={"size": [_("Максимальний розмір файлу — {mb} MB.").format(mb=max_mb)]})
    media_id = uuid.uuid4()
    key = f"uploads/{user.pk}/{media_id}/original.{EXTENSIONS[content_type]}"
    media = Media.objects.create(
        id=media_id,
        owner=user,
        kind=kind,
        declared_content_type=content_type,
        declared_size=size,
        original_key=key,
    )
    upload = storage.presigned_post(key, content_type, settings.MEDIA_MAX_UPLOAD_BYTES)
    return media, upload


def confirm_upload(user: User, media_id) -> Media:
    try:
        return _confirm_upload(user, media_id)
    except ValidationFailed:
        # Mark as failed outside the rolled-back transaction and drop the rejected original.
        media = Media.objects.filter(id=media_id, owner=user, status=Media.Status.PENDING).first()
        if media:
            _fail(media)
        raise


@transaction.atomic
def _confirm_upload(user: User, media_id) -> Media:
    media = Media.objects.select_for_update().filter(id=media_id).first()
    if media is None or media.owner_id != user.pk:
        raise NotFound()
    if media.status == Media.Status.READY:
        return media  # idempotent
    if media.status == Media.Status.FAILED:
        raise InvalidState(_("Файл відхилено."), code="MEDIA_FAILED")

    meta = storage.head(media.original_key)
    if meta is None:
        raise InvalidState(_("Файл ще не завантажено."), code="MEDIA_NOT_UPLOADED")
    if meta.get("ContentLength", 0) > settings.MEDIA_MAX_UPLOAD_BYTES:
        raise ValidationFailed(details={"size": [_("Файл занадто великий.")]})
    processed = process_image(storage.download(media.original_key))
    base = media.original_key.rsplit("/", 1)[0]
    media.key = f"{base}/image.webp"
    media.thumbnail_key = f"{base}/thumb.webp"
    storage.upload(media.key, processed.data, processed.content_type)
    storage.upload(media.thumbnail_key, processed.thumbnail, processed.content_type)
    storage.delete(media.original_key)
    media.status = Media.Status.READY
    media.content_type = processed.content_type
    media.size = len(processed.data)
    media.width = processed.width
    media.height = processed.height
    media.processed_at = timezone.now()
    media.save()
    return media


def _fail(media: Media) -> None:
    media.status = Media.Status.FAILED
    media.save(update_fields=["status"])
    try:
        storage.delete(media.original_key)
    except Exception:
        logger.warning("media_delete_failed", extra={"media_id": str(media.id)})


def get_ready_media_for_owner(user: User, media_id, *, kind: str) -> Media:
    media = Media.objects.filter(id=media_id).first()
    if media is None or media.owner_id != user.pk:
        raise ValidationFailed(details={"media": [_("Файл не знайдено.")]})
    if media.status != Media.Status.READY or media.kind != kind:
        raise ValidationFailed(details={"media": [_("Файл не готовий або має неправильний тип.")]})
    if not media.is_attached:
        media.is_attached = True
        media.save(update_fields=["is_attached"])
    return media


def get_ready_media_list(user: User, media_ids: list, *, kind: str) -> list[Media]:
    return [get_ready_media_for_owner(user, mid, kind=kind) for mid in dict.fromkeys(media_ids)]


def delete_media(user: User, media_id) -> None:
    media = Media.objects.filter(id=media_id, owner=user).first()
    if media is None:
        raise NotFound()
    if media.is_attached:
        raise Forbidden(_("Файл вже використовується."), code="MEDIA_IN_USE")
    storage.delete(media.original_key, media.key, media.thumbnail_key)
    media.delete()


def cleanup_expired_media() -> int:
    """Remove never-confirmed uploads, failed uploads and never-attached images."""
    cutoff = timezone.now() - timedelta(hours=settings.MEDIA_PENDING_TTL_HOURS)
    stale = Media.objects.filter(created_at__lt=cutoff, is_attached=False)
    count = 0
    for media in stale.iterator():
        try:
            storage.delete(media.original_key, media.key, media.thumbnail_key)
        except Exception:
            logger.warning("media_cleanup_failed", extra={"media_id": str(media.id)})
            continue
        media.delete()
        count += 1
    return count
