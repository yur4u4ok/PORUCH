"""Database backups in object storage (R2/S3), under the private `backups/` prefix.

    manage.py backups upload /backups/poruch-2026-10-06.dump   # upload + prune old copies
    manage.py backups list
    manage.py backups download backups/poruch-2026-10-06.dump /backups/restore.dump

Dumps are made by `pg_dump` outside Django (scripts/server/backup.sh); this only moves files.
"""

from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.media import storage

PREFIX = "backups/"


class Command(BaseCommand):
    help = "Upload, list, download and prune database backups in object storage."

    def add_arguments(self, parser):
        sub = parser.add_subparsers(dest="action", required=True)
        up = sub.add_parser("upload")
        up.add_argument("path")
        up.add_argument("--keep-days", type=int, default=settings.BACKUP_KEEP_DAYS)
        sub.add_parser("list")
        down = sub.add_parser("download")
        down.add_argument("key")
        down.add_argument("path")

    def handle(self, *args, action, **options):
        client, bucket = storage.internal_client(), storage.bucket()
        if action == "upload":
            path = Path(options["path"])
            if not path.is_file() or path.stat().st_size == 0:
                raise CommandError(f"Backup file is missing or empty: {path}")
            key = PREFIX + path.name
            client.upload_file(str(path), bucket, key)
            self.stdout.write(f"uploaded {key} ({path.stat().st_size // 1024} KB)")
            self._prune(client, bucket, options["keep_days"])
        elif action == "list":
            for obj in self._objects(client, bucket):
                self.stdout.write(f"{obj['Key']}\t{obj['Size'] // 1024} KB\t{obj['LastModified']:%Y-%m-%d %H:%M}")
        else:
            client.download_file(bucket, options["key"], options["path"])
            self.stdout.write(f"downloaded {options['key']} -> {options['path']}")

    def _objects(self, client, bucket):
        pages = client.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=PREFIX)
        return sorted((obj for page in pages for obj in page.get("Contents", [])), key=lambda o: o["Key"])

    def _prune(self, client, bucket, keep_days: int):
        cutoff = timezone.now() - timedelta(days=keep_days)
        for obj in self._objects(client, bucket):
            if obj["LastModified"] < cutoff:
                client.delete_object(Bucket=bucket, Key=obj["Key"])
                self.stdout.write(f"pruned {obj['Key']}")
