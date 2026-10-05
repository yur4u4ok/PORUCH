from django.db import migrations

from apps.users.reference_data import seed_capabilities


def seed(apps, schema_editor):
    seed_capabilities(apps.get_model("users", "Capability"))


class Migration(migrations.Migration):
    dependencies = [("users", "0002_initial")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
