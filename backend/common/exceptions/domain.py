"""Domain exceptions raised by the service layer and mapped to API errors."""

from typing import Any


class DomainError(Exception):
    status_code = 400
    code = "DOMAIN_ERROR"
    default_message = "Operation is not allowed."

    def __init__(self, message: str | None = None, *, code: str | None = None, details: Any = None):
        self.message = message or self.default_message
        if code:
            self.code = code
        self.details = details or {}
        super().__init__(self.message)


class ValidationFailed(DomainError):
    status_code = 400
    code = "VALIDATION_ERROR"
    default_message = "Invalid request"


class InvalidState(DomainError):
    status_code = 409
    code = "INVALID_STATE"
    default_message = "Operation is not allowed in the current state."


class Conflict(DomainError):
    status_code = 409
    code = "CONFLICT"
    default_message = "Conflict."


class Forbidden(DomainError):
    status_code = 403
    code = "PERMISSION_DENIED"
    default_message = "You do not have permission to perform this action."


class NotFound(DomainError):
    status_code = 404
    code = "NOT_FOUND"
    default_message = "Not found."
