from datetime import timedelta
from pathlib import Path

from django.core.management import call_command
from django.utils import timezone


class FakeS3:
    def __init__(self):
        self.objects = {}

    def upload_file(self, path, bucket, key):
        self.objects[key] = {"Key": key, "Size": 2048, "LastModified": timezone.now()}

    def download_file(self, bucket, key, path):
        Path(path).write_bytes(b"dump")

    def delete_object(self, Bucket, Key):
        del self.objects[Key]

    def get_paginator(self, name):
        objects = self.objects

        class Paginator:
            def paginate(self, Bucket, Prefix):
                return [{"Contents": [o for k, o in objects.items() if k.startswith(Prefix)]}]

        return Paginator()


def test_upload_prunes_copies_older_than_keep_days(tmp_path, monkeypatch, capsys):
    from apps.media import storage

    s3 = FakeS3()
    monkeypatch.setattr(storage, "internal_client", lambda: s3)
    s3.objects["backups/old.dump"] = {
        "Key": "backups/old.dump",
        "Size": 1,
        "LastModified": timezone.now() - timedelta(days=20),
    }
    s3.objects["backups/recent.dump"] = {
        "Key": "backups/recent.dump",
        "Size": 1,
        "LastModified": timezone.now() - timedelta(days=2),
    }
    s3.objects["uploads/photo.jpg"] = {
        "Key": "uploads/photo.jpg",
        "Size": 1,
        "LastModified": timezone.now() - timedelta(days=99),
    }
    dump = tmp_path / "poruch-2026-10-06.dump"
    dump.write_bytes(b"PGDMP")

    call_command("backups", "upload", str(dump), "--keep-days", "14")

    assert set(s3.objects) == {"backups/recent.dump", "backups/poruch-2026-10-06.dump", "uploads/photo.jpg"}
    assert "pruned backups/old.dump" in capsys.readouterr().out
