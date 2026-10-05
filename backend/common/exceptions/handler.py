"""Centralised DRF exception handler producing {code, message, details}."""

import logging
from typing import Any

from django.core.exceptions import PermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

from .domain import DomainError

logger = logging.getLogger(__name__)

_CODE_BY_EXCEPTION: list[tuple[type[Exception], str, str]] = [
    (exceptions.ValidationError, "VALIDATION_ERROR", "Invalid request"),
    (exceptions.NotAuthenticated, "NOT_AUTHENTICATED", "Authentication credentials were not provided."),
    (exceptions.AuthenticationFailed, "AUTHENTICATION_FAILED", "Authentication failed."),
    (exceptions.PermissionDenied, "PERMISSION_DENIED", "Permission denied."),
    (exceptions.NotFound, "NOT_FOUND", "Not found."),
    (exceptions.MethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed."),
    (exceptions.Throttled, "RATE_LIMITED", "Too many requests."),
    (exceptions.ParseError, "PARSE_ERROR", "Malformed request."),
    (exceptions.UnsupportedMediaType, "UNSUPPORTED_MEDIA_TYPE", "Unsupported media type."),
]


def _error(code: str, message: str, details: Any, http_status: int) -> Response:
    return Response({"code": code, "message": message, "details": details or {}}, status=http_status)


def api_exception_handler(exc: Exception, context: dict) -> Response | None:
    if isinstance(exc, DomainError):
        return _error(exc.code, exc.message, exc.details, exc.status_code)

    if isinstance(exc, DjangoValidationError):
        details = exc.message_dict if hasattr(exc, "error_dict") else {"non_field_errors": exc.messages}
        return _error("VALIDATION_ERROR", "Invalid request", details, status.HTTP_400_BAD_REQUEST)

    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, PermissionDenied):
        exc = exceptions.PermissionDenied()

    response = exception_handler(exc, context)
    if response is None:
        logger.exception("unhandled_exception", exc_info=exc)
        return _error("SERVER_ERROR", "Internal server error.", {}, status.HTTP_500_INTERNAL_SERVER_ERROR)

    code, message = next(
        ((c, m) for exc_class, c, m in _CODE_BY_EXCEPTION if isinstance(exc, exc_class)),
        ("ERROR", "Request failed."),
    )

    data = response.data
    error_details: dict[str, Any] = {}
    if isinstance(exc, exceptions.ValidationError):
        error_details = data if isinstance(data, dict) else {"non_field_errors": data}
    else:
        detail = data.get("detail") if isinstance(data, dict) else None
        if detail:
            message = str(detail)
        wait = getattr(exc, "wait", None)
        if isinstance(exc, exceptions.Throttled) and wait:
            error_details = {"retry_after": int(wait)}

    response.data = {"code": code, "message": message, "details": error_details}
    return response
