from django.db import migrations


def backfill_nightly(apps, schema_editor):
    """
    Pre-existing listings were created as nightly (they have host_price_per_night
    and no monthly_rent). The new rental_type column defaulted them to 'monthly',
    which is wrong — set them back to 'nightly'.
    """
    Listing = apps.get_model("listings", "Listing")
    Listing.objects.filter(
        monthly_rent__isnull=True,
        host_price_per_night__isnull=False,
    ).update(rental_type="nightly")


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("listings", "0006_listing_available_from_listing_cook_available_and_more"),
    ]
    operations = [migrations.RunPython(backfill_nightly, noop)]
