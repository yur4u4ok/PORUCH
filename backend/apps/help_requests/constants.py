"""Shared enumerations of the help domain (used across apps)."""

from django.db import models


class Category(models.TextChoices):
    AUTO = "AUTO", "Автомобіль"
    HOME = "HOME", "Дім"
    ITEMS = "ITEMS", "Речі"
    ANIMALS = "ANIMALS", "Тварини"
    PEOPLE = "PEOPLE", "Людина"
    DISTRICT = "DISTRICT", "Район"
    URGENT = "URGENT", "Терміново"
    OTHER = "OTHER", "Інше"


# Subcategories per category (use cases from the product spec). Frontend translates codes.
SUBCATEGORIES: dict[str, list[str]] = {
    Category.AUTO: [
        "FLAT_TIRE",
        "DEAD_BATTERY",
        "JUMPER_CABLES",
        "COMPRESSOR",
        "JACK",
        "OUT_OF_FUEL",
        "PULL_OUT",
        "TOWING",
        "LOCKED_KEYS",
        "MINOR_TECH",
    ],
    Category.HOME: [
        "CARRY_HEAVY",
        "FURNITURE_ASSEMBLY",
        "REPAIR",
        "NEED_TOOL",
        "DRILL_HOLE",
        "MOVING",
        "PHYSICAL_HELP",
    ],
    Category.ITEMS: ["BORROW_TOOL", "BORROW_ITEM", "HAND_OVER", "PICK_UP", "DELIVER", "LOST_ITEM"],
    Category.ANIMALS: ["LOST_PET", "FOUND_PET", "TRANSPORT_PET", "SEARCH_HELP"],
    Category.PEOPLE: ["ELDERLY_HELP", "CARRY_THINGS", "ACCOMPANY", "LOST_PERSON"],
    Category.DISTRICT: ["DANGER_WARNING", "AFTER_STORM", "FIND_LOST_ITEM", "LOCAL_SITUATION"],
    Category.URGENT: [],
    Category.OTHER: [],
}

# Categories a user can enable for notifications (spec §26).
NOTIFICATION_CATEGORIES = [
    Category.AUTO,
    Category.HOME,
    Category.ITEMS,
    Category.ANIMALS,
    Category.PEOPLE,
    Category.DISTRICT,
    Category.URGENT,
]

NOTIFICATION_CATEGORY_VALUES = [c.value for c in NOTIFICATION_CATEGORIES]


class Urgency(models.TextChoices):
    NOW = "NOW", "Зараз"
    TODAY = "TODAY", "Сьогодні"
    WHENEVER = "WHENEVER", "Коли буде можливість"


URGENCY_RANK = {Urgency.NOW: 0, Urgency.TODAY: 1, Urgency.WHENEVER: 2}


class RewardType(models.TextChoices):
    NONE = "NONE", "Просто допомога"
    WILLING = "WILLING", "Готовий віддячити"
    UNSURE = "UNSURE", "Не знаю"


class RewardOption(models.TextChoices):
    """Non-monetary ways to say thanks (with «Готовий(-а) віддячити»)."""

    PIZZA = "PIZZA", "Поставлю піцу"
    COFFEE = "COFFEE", "Кава"
    RETURN_HELP = "RETURN_HELP", "Допоможу у відповідь"
    GIVE_ITEM = "GIVE_ITEM", "Віддам/позичу річ"


class HelpRequestStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Активний"
    IN_PROGRESS = "IN_PROGRESS", "Виконується"
    COMPLETED = "COMPLETED", "Завершено"
    CANCELLED = "CANCELLED", "Скасовано"
    EXPIRED = "EXPIRED", "Термін минув"


CLOSED_STATUSES = {HelpRequestStatus.COMPLETED, HelpRequestStatus.CANCELLED, HelpRequestStatus.EXPIRED}
