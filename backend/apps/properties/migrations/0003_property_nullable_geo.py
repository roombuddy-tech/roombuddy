from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("properties", "0002_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="property",
            name="latitude",
            field=models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True),
        ),
        migrations.AlterField(
            model_name="property",
            name="longitude",
            field=models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True),
        ),
        migrations.AlterField(
            model_name="property",
            name="city_id",
            field=models.UUIDField(null=True, blank=True),
        ),
        migrations.AlterField(
            model_name="property",
            name="pincode",
            field=models.CharField(max_length=10, null=True, blank=True),
        ),
    ]
