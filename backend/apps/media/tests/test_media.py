import io
from datetime import timedelta

import pytest
from django.utils import timezone
from PIL import Image

from apps.media.models import Media
from apps.media.services.media import cleanup_expired_media

pytestmark = pytest.mark.django_db


def jpeg_bytes(size=(3000, 2000), exif=True) -> bytes:
    img = Image.new("RGB", size, (200, 30, 30))
    buf = io.BytesIO()
    kwargs = {}
    if exif:
        exif_data = Image.Exif()
        exif_data[0x010F] = "SecretCam"  # Make
        kwargs["exif"] = exif_data
    img.save(buf, format="JPEG", **kwargs)
    return buf.getvalue()


def request_upload(client, content_type="image/jpeg", size=1000, kind="HELP_REQUEST"):
    return client.post(
        "/api/v1/media/upload-url/", {"kind": kind, "content_type": content_type, "size": size}, format="json"
    )


def test_upload_url_validation(auth_client, s3):
    assert request_upload(auth_client, content_type="image/svg+xml").status_code == 400
    assert request_upload(auth_client, content_type="text/html").status_code == 400
    assert request_upload(auth_client, size=11 * 1024 * 1024).status_code == 400
    response = request_upload(auth_client)
    assert response.status_code == 201
    upload = response.data["upload"]
    assert upload["method"] == "PUT" and upload["headers"]["Content-Type"] == "image/jpeg"
    # Type and exact size are signed: a different file cannot reuse the URL.
    assert "content-length" in upload["url"].lower() and "content-type" in upload["url"].lower()


def test_confirm_processes_image(auth_client, s3):
    data = request_upload(auth_client).data
    media = Media.objects.get(id=data["media_id"])
    s3.upload(media.original_key, jpeg_bytes(), "image/jpeg")
    response = auth_client.post("/api/v1/media/confirm/", {"media_id": data["media_id"]}, format="json")
    assert response.status_code == 200, response.data
    assert response.data["status"] == "READY"
    assert max(response.data["width"], response.data["height"]) == 1600
    media.refresh_from_db()
    processed = Image.open(io.BytesIO(s3.download(media.key)))
    assert processed.format == "WEBP"
    assert not processed.getexif()  # metadata stripped
    thumb = Image.open(io.BytesIO(s3.download(media.thumbnail_key)))
    assert max(thumb.size) == 400
    assert s3.head(media.original_key) is None  # original removed
    # idempotent confirm
    assert auth_client.post("/api/v1/media/confirm/", {"media_id": data["media_id"]}, format="json").status_code == 200


def test_confirm_rejects_fake_image(auth_client, s3):
    data = request_upload(auth_client).data
    media = Media.objects.get(id=data["media_id"])
    s3.upload(
        media.original_key, b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", "image/jpeg"
    )
    response = auth_client.post("/api/v1/media/confirm/", {"media_id": data["media_id"]}, format="json")
    assert response.status_code == 400
    assert response.data["code"] == "INVALID_FILE"
    media.refresh_from_db()
    assert media.status == "FAILED"


def test_confirm_before_upload(auth_client, s3):
    data = request_upload(auth_client).data
    response = auth_client.post("/api/v1/media/confirm/", {"media_id": data["media_id"]}, format="json")
    assert response.status_code == 409


def test_other_user_cannot_confirm_or_use(auth_client, make_client, s3, lviv):
    data = request_upload(auth_client).data
    media = Media.objects.get(id=data["media_id"])
    s3.upload(media.original_key, jpeg_bytes((100, 100)), "image/jpeg")
    other = make_client()
    assert other.post("/api/v1/media/confirm/", {"media_id": data["media_id"]}, format="json").status_code == 404
    auth_client.post("/api/v1/media/confirm/", {"media_id": data["media_id"]}, format="json")
    response = other.post(
        "/api/v1/help-requests/",
        {"category": "AUTO", "description": "x", "location": lviv, "urgency": "NOW", "photo_ids": [data["media_id"]]},
        format="json",
    )
    assert response.status_code == 400


def test_help_request_with_photos(auth_client, s3, lviv):
    ids = []
    for _ in range(2):
        data = request_upload(auth_client).data
        media = Media.objects.get(id=data["media_id"])
        s3.upload(media.original_key, jpeg_bytes((200, 200), exif=False), "image/jpeg")
        auth_client.post("/api/v1/media/confirm/", {"media_id": data["media_id"]}, format="json")
        ids.append(data["media_id"])
    response = auth_client.post(
        "/api/v1/help-requests/",
        {"category": "HOME", "description": "Шафа", "location": lviv, "urgency": "TODAY", "photo_ids": ids},
        format="json",
    )
    assert response.status_code == 201
    assert len(response.data["photos"]) == 2
    assert response.data["photos"][0]["thumbnail_url"].startswith("https://")
    assert Media.objects.filter(id__in=ids, is_attached=True).count() == 2


def test_cleanup_expired_media(user, s3):
    old = Media.objects.create(
        owner=user,
        kind="CHAT",
        declared_content_type="image/jpeg",
        declared_size=1,
        original_key="uploads/x/original.jpg",
    )
    Media.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=2))
    fresh = Media.objects.create(
        owner=user,
        kind="CHAT",
        declared_content_type="image/jpeg",
        declared_size=1,
        original_key="uploads/y/original.jpg",
    )
    attached = Media.objects.create(
        owner=user,
        kind="CHAT",
        declared_content_type="image/jpeg",
        declared_size=1,
        original_key="uploads/z/original.jpg",
        is_attached=True,
    )
    Media.objects.filter(pk=attached.pk).update(created_at=timezone.now() - timedelta(days=2))
    assert cleanup_expired_media() == 1
    assert set(Media.objects.values_list("id", flat=True)) == {fresh.id, attached.id}


def test_phone_mpo_jpeg_is_accepted(auth_client, s3):
    """Samsung/Android "motion" photos are MPO (multi-frame JPEG) and must upload like any photo."""
    main, extra = Image.new("RGB", (2400, 1600), (10, 120, 100)), Image.new("RGB", (640, 480), (0, 0, 0))
    buf = io.BytesIO()
    main.save(buf, format="MPO", save_all=True, append_images=[extra])
    assert Image.open(io.BytesIO(buf.getvalue())).format == "MPO"

    data = request_upload(auth_client, size=len(buf.getvalue()), kind="CHAT").data
    s3.upload(Media.objects.get(id=data["media_id"]).original_key, buf.getvalue(), "image/jpeg")
    response = auth_client.post("/api/v1/media/confirm/", {"media_id": data["media_id"]}, format="json")
    assert response.status_code == 200, response.data
    assert (response.data["width"], response.data["height"]) == (1600, 1067)
