from django.core.management.base import BaseCommand

from apps.media import storage


class Command(BaseCommand):
    help = "Create the media bucket if it does not exist (MinIO / S3)."

    def handle(self, *args, **options):
        created = storage.ensure_bucket()
        self.stdout.write(self.style.SUCCESS(f"Bucket {storage.bucket()} {'created' if created else 'exists'}."))
