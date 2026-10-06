"""Image validation and optimisation (real MIME detection, resize, thumbnail, metadata strip)."""

import io
import warnings
from dataclasses import dataclass

from django.conf import settings
from PIL import Image, ImageOps, UnidentifiedImageError

from common.exceptions import ValidationFailed

# MPO = JPEG with extra frames (Samsung/Android "motion" photos, some iPhone exports): Pillow
# reports it as its own format, but every phone shows it as an ordinary JPEG. First frame is used.
FORMAT_TO_MIME = {"JPEG": "image/jpeg", "MPO": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
MAX_PIXELS = 40_000_000


@dataclass
class ProcessedImage:
    data: bytes
    thumbnail: bytes
    width: int
    height: int
    content_type: str = "image/webp"


def detect_mime(data: bytes) -> str:
    """Return real MIME type from file content; raise for anything that is not an allowed image."""
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            with Image.open(io.BytesIO(data)) as img:
                fmt = img.format
                img.verify()
        except (
            UnidentifiedImageError,
            OSError,
            SyntaxError,
            Image.DecompressionBombWarning,
            Image.DecompressionBombError,
        ) as exc:
            raise ValidationFailed(
                "Unsupported file", code="INVALID_FILE", details={"file": ["Файл не є підтримуваним зображенням."]}
            ) from exc
    mime = FORMAT_TO_MIME.get(fmt or "")
    if mime not in settings.MEDIA_ALLOWED_CONTENT_TYPES:
        raise ValidationFailed(
            "Unsupported file", code="INVALID_FILE", details={"file": ["Дозволені формати: JPEG, PNG, WEBP."]}
        )
    return mime


def _encode(img: Image.Image, max_dim: int) -> tuple[bytes, int, int]:
    copy = img.copy()
    copy.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    # No exif/icc passed -> metadata (GPS etc.) is stripped.
    copy.save(buf, format="WEBP", quality=82, method=4)
    return buf.getvalue(), copy.width, copy.height


def process_image(data: bytes) -> ProcessedImage:
    detect_mime(data)
    with Image.open(io.BytesIO(data)) as img:
        img.seek(0)  # multi-frame (MPO): the main picture
        if img.width * img.height > MAX_PIXELS:
            raise ValidationFailed(
                "Image too large", code="INVALID_FILE", details={"file": ["Зображення занадто велике."]}
            )
        oriented = ImageOps.exif_transpose(img)
        normalized = oriented.convert("RGBA") if oriented.mode in ("RGBA", "LA", "P") else oriented.convert("RGB")
        optimized, width, height = _encode(normalized, settings.MEDIA_MAX_DIMENSION)
        thumbnail, _, _ = _encode(normalized, settings.MEDIA_THUMBNAIL_DIMENSION)
    return ProcessedImage(data=optimized, thumbnail=thumbnail, width=width, height=height)
