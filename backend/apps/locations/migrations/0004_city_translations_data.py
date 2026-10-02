from django.db import migrations

from apps.locations.reference_data import seed_default_city


def seed(apps, schema_editor):
    seed_default_city(apps.get_model("locations", "City"))


class Migration(migrations.Migration):
    dependencies = [("locations", "0003_city_translations")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
