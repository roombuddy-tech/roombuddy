import uuid

from django.db import migrations

AMENITY_DATA = [
    {
        "code": "essentials",
        "display_name": "Essentials",
        "display_order": 1,
        "amenities": [
            {"code": "wifi", "display_name": "WiFi", "is_popular": True, "display_order": 1},
            {"code": "ac", "display_name": "AC", "is_popular": True, "display_order": 2},
            {"code": "geyser_hot_water", "display_name": "Geyser / Hot water", "is_popular": True, "display_order": 3},
            {"code": "power_backup", "display_name": "Power backup", "is_popular": False, "display_order": 4},
            {"code": "washing_machine", "display_name": "Washing machine", "is_popular": True, "display_order": 5},
            {"code": "iron", "display_name": "Iron", "is_popular": False, "display_order": 6},
            {"code": "hair_dryer", "display_name": "Hair dryer", "is_popular": False, "display_order": 7},
        ],
    },
    {
        "code": "kitchen_food",
        "display_name": "Kitchen & Food",
        "display_order": 2,
        "amenities": [
            {"code": "full_kitchen_access", "display_name": "Full kitchen access", "is_popular": True, "display_order": 1},
            {"code": "fridge", "display_name": "Fridge", "is_popular": True, "display_order": 2},
            {"code": "microwave", "display_name": "Microwave", "is_popular": False, "display_order": 3},
            {"code": "gas_stove", "display_name": "Gas stove", "is_popular": False, "display_order": 4},
            {"code": "water_purifier", "display_name": "Water purifier", "is_popular": False, "display_order": 5},
            {"code": "utensils_provided", "display_name": "Utensils provided", "is_popular": False, "display_order": 6},
        ],
    },
    {
        "code": "comfort",
        "display_name": "Comfort",
        "display_order": 3,
        "amenities": [
            {"code": "tv", "display_name": "TV", "is_popular": False, "display_order": 1},
            {"code": "sofa_common_area", "display_name": "Sofa / Common area", "is_popular": False, "display_order": 2},
            {"code": "workspace_desk", "display_name": "Workspace / Desk", "is_popular": True, "display_order": 3},
            {"code": "parking_2_wheeler", "display_name": "Parking (2-wheeler)", "is_popular": False, "display_order": 4},
            {"code": "parking_4_wheeler", "display_name": "Parking (4-wheeler)", "is_popular": False, "display_order": 5},
            {"code": "lift_elevator", "display_name": "Lift / Elevator", "is_popular": False, "display_order": 6},
        ],
    },
    {
        "code": "safety",
        "display_name": "Safety",
        "display_order": 4,
        "amenities": [
            {"code": "cctv_common", "display_name": "CCTV (common areas)", "is_popular": False, "display_order": 1},
            {"code": "security_guard", "display_name": "Security guard", "is_popular": False, "display_order": 2},
            {"code": "fire_extinguisher", "display_name": "Fire extinguisher", "is_popular": False, "display_order": 3},
            {"code": "first_aid_kit", "display_name": "First aid kit", "is_popular": False, "display_order": 4},
            {"code": "door_lock_on_room", "display_name": "Door lock on room", "is_popular": False, "display_order": 5},
        ],
    },
]


def seed_amenities(apps, schema_editor):
    AmenityCategory = apps.get_model("amenities", "AmenityCategory")
    AmenityDefinition = apps.get_model("amenities", "AmenityDefinition")

    for cat_data in AMENITY_DATA:
        cat = AmenityCategory.objects.create(
            id=uuid.uuid4(),
            code=cat_data["code"],
            display_name=cat_data["display_name"],
            display_order=cat_data["display_order"],
        )
        for a in cat_data["amenities"]:
            AmenityDefinition.objects.create(
                id=uuid.uuid4(),
                category=cat,
                code=a["code"],
                display_name=a["display_name"],
                is_popular=a["is_popular"],
                display_order=a["display_order"],
            )


def unseed_amenities(apps, schema_editor):
    AmenityCategory = apps.get_model("amenities", "AmenityCategory")
    AmenityCategory.objects.filter(
        code__in=["essentials", "kitchen_food", "comfort", "safety"]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("amenities", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_amenities, unseed_amenities),
    ]
