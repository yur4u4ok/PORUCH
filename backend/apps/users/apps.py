from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = "apps.users"
    label = "users"
    verbose_name = "Користувачі"

    def ready(self) -> None:
        from apps.users import schema  # noqa: F401  (registers OpenAPI auth extension)
