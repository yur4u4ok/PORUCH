import secrets

from django.db import migrations, models

import apps.help_requests.models


def fill_codes(apps, schema_editor):
    HelpRequest = apps.get_model("help_requests", "HelpRequest")
    used = set()
    for hr in HelpRequest.objects.filter(share_code__isnull=True).only("id"):
        code = secrets.token_urlsafe(6)
        while code in used:
            code = secrets.token_urlsafe(6)
        used.add(code)
        HelpRequest.objects.filter(pk=hr.pk).update(share_code=code)


class Migration(migrations.Migration):
    dependencies = [("help_requests", "0003_reward_offers")]

    operations = [
        migrations.AddField(
            model_name="helprequest",
            name="share_code",
            field=models.CharField(max_length=16, null=True, editable=False),
        ),
        migrations.RunPython(fill_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="helprequest",
            name="share_code",
            field=models.CharField(
                default=apps.help_requests.models.new_share_code, editable=False, max_length=16, unique=True
            ),
        ),
    ]
