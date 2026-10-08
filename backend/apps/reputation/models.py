from django.conf import settings
from django.core.validators import MaxLengthValidator
from django.db import models

from common.models import UUIDModel


class ThankYou(UUIDModel):
    from_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="given_thanks")
    to_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_thanks")
    help_request = models.ForeignKey("help_requests.HelpRequest", on_delete=models.CASCADE, related_name="thanks")
    message = models.TextField(max_length=500, blank=True, validators=[MaxLengthValidator(500)])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "подяка"
        verbose_name_plural = "подяки"
        constraints = [
            # One thank-you per helper of a request (a request may have several helpers).
            models.UniqueConstraint(fields=["help_request", "to_user"], name="unique_thank_you_per_helper"),
        ]

    def __str__(self) -> str:
        return f"Thanks {self.from_user_id} → {self.to_user_id}"
