from django.db import models


class ResponseStatus(models.TextChoices):
    PENDING = "PENDING", "Очікує"
    ACCEPTED = "ACCEPTED", "Прийнято"
    REJECTED = "REJECTED", "Відхилено"
    CANCELLED = "CANCELLED", "Скасовано"


ACTIVE_RESPONSE_STATUSES = [ResponseStatus.PENDING, ResponseStatus.ACCEPTED]
