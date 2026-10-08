from django.db import migrations


def show_everyone(apps, schema_editor):
    apps.get_model("users", "Profile").objects.update(show_name=True, show_avatar=True)


class Migration(migrations.Migration):
    dependencies = [("users", "0006_contacts")]

    operations = [migrations.RunPython(show_everyone, migrations.RunPython.noop)]
