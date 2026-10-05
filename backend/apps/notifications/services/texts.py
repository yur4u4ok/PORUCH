"""User-facing notification texts. Never include private data (names, addresses, phones)."""

from django.utils.translation import gettext_lazy as _

from apps.help_requests.constants import Category, Urgency

CATEGORY_PHRASES = {
    Category.AUTO: _("Проблема з автомобілем"),
    Category.HOME: _("Потрібна допомога вдома"),
    Category.ITEMS: _("Потрібна річ або передача"),
    Category.ANIMALS: _("Допомога з твариною"),
    Category.PEOPLE: _("Потрібна допомога людині"),
    Category.DISTRICT: _("Ситуація в районі"),
    Category.URGENT: _("Термінова ситуація"),
    Category.OTHER: _("Потрібна допомога"),
}

URGENCY_PHRASES = {
    Urgency.NOW: _("🔴 Потрібна допомога зараз"),
    Urgency.TODAY: _("🟡 Сьогодні"),
    Urgency.WHENEVER: _("🟢 Коли буде можливість"),
}


def format_distance(meters: float | None) -> str:
    if meters is None:
        return ""
    rounded = max(100, int(round(meters / 100) * 100))
    if rounded < 1000:
        return str(_("{m} м від вас")).format(m=rounded)
    return str(_("{km} км від вас")).format(km=f"{rounded / 1000:.1f}".replace(".", ","))
