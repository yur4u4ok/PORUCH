from django.db import models


class ResponseStatus(models.TextChoices):
    PENDING = "PENDING", "Очікує"
    ACCEPTED = "ACCEPTED", "Прийнято"
    REJECTED = "REJECTED", "Відхилено"
    CANCELLED = "CANCELLED", "Скасовано"


ACTIVE_RESPONSE_STATUSES = [ResponseStatus.PENDING, ResponseStatus.ACCEPTED]


class OfferType(models.TextChoices):
    """What the helper proposes when responding to a request with a reward."""

    ACCEPT = "ACCEPT", "Згоден(-на) на умови автора"
    COUNTER = "COUNTER", "Пропоную іншу суму"
    FREE = "FREE", "Допоможу без оплати"
