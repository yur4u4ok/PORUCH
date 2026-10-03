"""Money display for server-side texts (chat notes, share previews). Amounts are informational only."""

from decimal import Decimal

# ISO 4217 codes the client may send. Unknown codes are rejected by the serializer.
SUPPORTED_CURRENCIES = (
    "UAH", "USD", "EUR", "GBP", "PLN", "CZK", "CHF", "SEK", "NOK", "DKK", "HUF", "RON", "MDL",
    "TRY", "JPY", "KRW", "CNY", "INR", "BRL", "MXN", "CAD", "AUD", "GEL",
)  # fmt: skip
DEFAULT_CURRENCY = "UAH"

_SUFFIX = {"UAH": "грн", "EUR": "€", "PLN": "zł", "CZK": "Kč", "TRY": "₺", "KRW": "₩", "INR": "₹", "GEL": "₾"}
_PREFIX = {"USD": "$", "GBP": "£", "JPY": "¥", "CNY": "¥", "BRL": "R$", "CAD": "CA$", "AUD": "A$", "MXN": "MX$"}


def format_money(amount: Decimal | int | float, currency: str = DEFAULT_CURRENCY) -> str:
    value = f"{Decimal(amount):.2f}".rstrip("0").rstrip(".")
    if currency in _PREFIX:
        return f"{_PREFIX[currency]}{value}"
    return f"{value} {_SUFFIX.get(currency, currency)}"
