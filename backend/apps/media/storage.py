"""Thin wrapper around S3-compatible object storage (AWS S3, MinIO, R2...)."""

from functools import lru_cache

import boto3
from botocore.config import Config
from django.conf import settings


def _client(endpoint_url: str | None):
    return boto3.client(
        "s3",
        endpoint_url=endpoint_url or None,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        region_name=settings.AWS_REGION,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


@lru_cache(maxsize=1)
def internal_client():
    return _client(settings.AWS_S3_ENDPOINT_URL)


@lru_cache(maxsize=1)
def public_client():
    """Used only to sign URLs that browsers will call."""
    return _client(settings.AWS_S3_PUBLIC_ENDPOINT_URL)


def bucket() -> str:
    return settings.AWS_STORAGE_BUCKET_NAME


def presigned_post(key: str, content_type: str, max_bytes: int) -> dict:
    return public_client().generate_presigned_post(
        Bucket=bucket(),
        Key=key,
        Fields={"Content-Type": content_type},
        Conditions=[{"Content-Type": content_type}, ["content-length-range", 1, max_bytes]],
        ExpiresIn=settings.MEDIA_PRESIGNED_TTL,
    )


def presigned_get(key: str) -> str:
    return public_client().generate_presigned_url(
        "get_object", Params={"Bucket": bucket(), "Key": key}, ExpiresIn=settings.MEDIA_PRESIGNED_TTL
    )


def head(key: str) -> dict | None:
    try:
        return internal_client().head_object(Bucket=bucket(), Key=key)
    except internal_client().exceptions.ClientError:
        return None


def download(key: str) -> bytes:
    return internal_client().get_object(Bucket=bucket(), Key=key)["Body"].read()


def upload(key: str, data: bytes, content_type: str) -> None:
    internal_client().put_object(
        Bucket=bucket(), Key=key, Body=data, ContentType=content_type, CacheControl="private, max-age=31536000"
    )


def delete(*keys: str) -> None:
    keys = tuple(k for k in keys if k)
    if keys:
        internal_client().delete_objects(Bucket=bucket(), Delete={"Objects": [{"Key": k} for k in keys]})


def ensure_bucket() -> bool:
    client = internal_client()
    try:
        client.head_bucket(Bucket=bucket())
        return False
    except client.exceptions.ClientError:
        kwargs = {}
        if settings.AWS_REGION and settings.AWS_REGION != "us-east-1":
            kwargs["CreateBucketConfiguration"] = {"LocationConstraint": settings.AWS_REGION}
        client.create_bucket(Bucket=bucket(), **kwargs)
        return True
