"""Reference capability catalog. Used by the data migration and by test fixtures."""

HELP_CAPABILITIES = [
    ("AUTO_TIRE", "AUTO", "🛞"),
    ("AUTO_BATTERY", "AUTO", "🔋"),
    ("AUTO_FUEL", "AUTO", "⛽"),
    ("AUTO_TOW", "AUTO", "🚛"),
    ("AUTO_TOOLS", "AUTO", "🔧"),
    ("HOUSE_MOVING", "HOME", "📦"),
    ("HOUSE_REPAIR", "HOME", "🛠"),
    ("HOUSE_ASSEMBLY", "HOME", "🪛"),
    ("HOUSE_TOOLS", "HOME", "🧰"),
    ("DELIVERY", "ITEMS", "🚚"),
    ("ITEM_LENDING", "ITEMS", "🤲"),
    ("ANIMAL_HELP", "ANIMALS", "🐕"),
    ("PERSON_HELP", "PEOPLE", "🧑‍🤝‍🧑"),
    ("OTHER", "OTHER", "🧩"),
]
ITEM_CAPABILITIES = [
    ("HAS_TOOLKIT", "HOME", "🧰"),
    ("HAS_DRILL", "HOME", "🪛"),
    ("HAS_LADDER", "HOME", "🪜"),
    ("HAS_CART", "ITEMS", "🛒"),
    ("HAS_CAR", "ITEMS", "🚙"),
    ("HAS_POWER", "DISTRICT", "🔋"),
    ("HAS_FIRST_AID", "PEOPLE", "🩹"),
    ("HAS_PET_CARRIER", "ANIMALS", "🐾"),
    ("HAS_JUMPER_CABLES", "AUTO", "🔌"),
    ("HAS_COMPRESSOR", "AUTO", "🛞"),
    ("HAS_OTHER", "OTHER", "🧩"),
]
# Retired codes are deactivated (kept for existing user data).
RETIRED_CAPABILITIES = ["HAS_JACK", "HAS_TOW_ROPE"]


def seed_capabilities(capability_model) -> None:
    for kind, rows in (("HELP", HELP_CAPABILITIES), ("ITEM", ITEM_CAPABILITIES)):
        for order, (code, category, emoji) in enumerate(rows):
            capability_model.objects.update_or_create(
                code=code,
                defaults={"kind": kind, "category": category, "emoji": emoji, "sort_order": order, "is_active": True},
            )
    capability_model.objects.filter(code__in=RETIRED_CAPABILITIES).update(is_active=False)
