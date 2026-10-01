"""Create demo users, capabilities, help requests, conversations and messages for local demos.

Coordinates are derived from the default City record, so nothing is hardcoded here.
"""

import math
import random

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.conversations.services.conversations import send_message
from apps.help_requests.models import HelpRequest
from apps.help_requests.services.create_request import create_help_request
from apps.help_requests.services.lifecycle import complete_help_request
from apps.interactions.services.responses import respond, select_helper
from apps.locations.models import City
from apps.notifications.services.preferences import update_preferences
from apps.reputation.services.thanks import create_thank_you
from apps.users.models import Profile, User
from apps.users.services.profile import set_capabilities

DEMO_DOMAIN = "demo.poruch.local"

USERS = [
    ("olena", "Олена", ["AUTO_TIRE", "AUTO_BATTERY", "HAS_JUMPER_CABLES", "HAS_COMPRESSOR"]),
    ("taras", "Тарас", ["HOUSE_MOVING", "HOUSE_ASSEMBLY", "HAS_TOOLKIT", "HAS_DRILL"]),
    ("iryna", "Ірина", ["ANIMAL_HELP", "PERSON_HELP", "DELIVERY"]),
    ("andrii", "Андрій", ["AUTO_TOW", "AUTO_FUEL", "HAS_TOW_ROPE", "HAS_CAR"]),
    ("sofia", "Софія", ["ITEM_LENDING", "HOUSE_TOOLS", "HAS_LADDER"]),
]

REQUESTS = [
    (
        "olena",
        "AUTO",
        "FLAT_TIRE",
        "Пробите колесо",
        "Пробила колесо біля ТРЦ, потрібен домкрат і хтось, хто допоможе.",
        "NOW",
        600,
        0,
    ),
    (
        "taras",
        "HOME",
        "CARRY_HEAVY",
        "Занести пральну машину",
        "Потрібно двоє людей занести пральну машину на 3 поверх.",
        "TODAY",
        -900,
        1200,
    ),
    (
        "iryna",
        "ANIMALS",
        "LOST_PET",
        "Загубився кіт",
        "Рудий кіт з білою грудкою, відгукується на «Пиріжок». Зник біля парку.",
        "TODAY",
        1500,
        -700,
    ),
    (
        "sofia",
        "ITEMS",
        "BORROW_TOOL",
        "Позичити дриль",
        "Потрібна дриль з перфорацією на годину, поверну одразу.",
        "WHENEVER",
        -2000,
        -1500,
    ),
    (
        "andrii",
        "AUTO",
        "DEAD_BATTERY",
        "Сів акумулятор",
        "Не заводиться авто, потрібні пускові дроти.",
        "NOW",
        300,
        2500,
    ),
]


def _offset(city: City, north_m: float, east_m: float) -> dict:
    lat = city.center.y + north_m / 111_320
    lng = city.center.x + east_m / (111_320 * math.cos(math.radians(city.center.y)))
    return {"latitude": lat, "longitude": lng, "accuracy": 20}


class Command(BaseCommand):
    help = "Seed demo data for local development (users @demo.poruch.local)."

    def add_arguments(self, parser):
        parser.add_argument("--password", default="demo-pass-123", help="Password for all demo users")
        parser.add_argument("--reset", action="store_true", help="Delete existing demo users first")

    @transaction.atomic
    def handle(self, *args, password, reset, **options):
        city = City.objects.filter(is_default=True).first()
        if city is None:
            raise CommandError("No default city. Run migrations first.")
        demo = User.objects.filter(email__endswith=f"@{DEMO_DOMAIN}")
        if reset:
            HelpRequest.objects.filter(author__in=demo).delete()
            demo.delete()
        elif demo.exists():
            self.stdout.write(self.style.WARNING("Demo data already exists (use --reset)."))
            return

        rng = random.Random(42)
        users: dict[str, User] = {}
        for slug, name, capabilities in USERS:
            user = User.objects.create_user(email=f"{slug}@{DEMO_DOMAIN}", password=password, email_verified=True)
            Profile.objects.create(user=user, display_name=name, city=city, onboarding_completed=True)
            update_preferences(
                user,
                {"location": _offset(city, rng.uniform(-1500, 1500), rng.uniform(-1500, 1500))},
            )
            set_capabilities(user, capabilities)
            users[slug] = user

        created = []
        for slug, category, sub, title, description, urgency, north, east in REQUESTS:
            created.append(
                create_help_request(
                    users[slug],
                    category=category,
                    subcategory=sub,
                    title=title,
                    description=description,
                    location=_offset(city, north, east),
                    urgency=urgency,
                )
            )

        # One full story: request → response → selection → chat → completion → thanks
        story = created[1]
        response, _ = respond(users["olena"], story.id, "Можу підійти за 20 хвилин")
        respond(users["andrii"], story.id, "Я поруч, можу допомогти")
        _, _, conversation = select_helper(users["taras"], story.id, response.id)
        send_message(users["olena"], conversation.id, text="Привіт! Я вже виходжу, буду за 20 хв.")
        send_message(users["taras"], conversation.id, text="Дякую! Під'їзд 2, домофон 15.")
        complete_help_request(users["taras"], story.id)
        create_thank_you(users["taras"], story.id, "Дуже дякую за допомогу! ❤️")

        # Another request in progress with an open chat
        in_progress = created[0]
        response, _ = respond(users["andrii"], in_progress.id, "Маю домкрат, під'їду")
        _, _, conversation = select_helper(users["olena"], in_progress.id, response.id)
        send_message(users["andrii"], conversation.id, text="Їду, буду за 10 хвилин.")

        # Pending response on an active request
        respond(users["sofia"], created[2].id, "Можу допомогти шукати ввечері")

        self.stdout.write(self.style.SUCCESS(f"Demo data created. Users: *@{DEMO_DOMAIN}, password: {password}"))
