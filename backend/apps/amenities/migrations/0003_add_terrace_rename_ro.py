
from django.db import migrations

# New amenity requested by hosts, plus a clearer name for the existing
# water purifier entry ("RO" is what people actually call it here).
NEW_AMENITIES = [
    {
        "category_code": "comfort",
        "code": "terrace_garden_access",
        "display_name": "Terrace / Garden access",
        "is_popular": True,
        "display_order": 7,
    },
]

RENAMES = [
    # (code, new display name, old display name)
    ("water_purifier", "RO / Water purifier", "Water purifier"),
]


def forwards(apps, schema_editor):
    AmenityCategory = apps.get_model("amenities", "AmenityCategory")
    AmenityDefinition = apps.get_model("amenities", "AmenityDefinition")

    for item in NEW_AMENITIES:
        category = AmenityCategory.objects.filter(code=item["category_code"]).first()
        if category is None:
            continue
        # id defaults to uuid4 on the model — passing it here would rewrite
        # the primary key when the row already exists.
        AmenityDefinition.objects.update_or_create(
            code=item["code"],
            defaults={
                "category": category,
                "display_name": item["display_name"],
                "is_popular": item["is_popular"],
                "display_order": item["display_order"],
            },
        )

    for code, new_name, _old in RENAMES:
        AmenityDefinition.objects.filter(code=code).update(display_name=new_name)


def backwards(apps, schema_editor):
    AmenityDefinition = apps.get_model("amenities", "AmenityDefinition")
    AmenityDefinition.objects.filter(
        code__in=[a["code"] for a in NEW_AMENITIES]
    ).delete()
    for code, _new, old_name in RENAMES:
        AmenityDefinition.objects.filter(code=code).update(display_name=old_name)


class Migration(migrations.Migration):

    dependencies = [
        ("amenities", "0002_seed_amenities"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
