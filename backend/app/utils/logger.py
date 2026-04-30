"""Centralized exception and context logging."""

from __future__ import annotations

import json
import logging
from typing import Any


def get_logger(name: str) -> logging.Logger:
    """Namespaced logger (e.g. ``app.api.routers.v1.chat``)."""
    return logging.getLogger(name)


def log_exception(
    logger: logging.Logger,
    exc: BaseException,
    *,
    context: str = "Unhandled exception",
    extra_data: dict[str, Any] | None = None,
) -> None:
    """Log exception with traceback (``exc_info``) and optional JSON-serializable context."""
    parts: list[str] = [context, f"{type(exc).__name__}: {exc}"]
    if isinstance(exc, BaseExceptionGroup):
        parts.append(f"ExceptionGroup[{len(exc.exceptions)} sub-exception(s)]")
    if extra_data is not None:
        try:
            parts.append(json.dumps(extra_data, default=str)[:8000])
        except (TypeError, ValueError):
            parts.append(repr(extra_data))
    logger.error(" | ".join(parts), exc_info=exc)


def log_warning(logger: logging.Logger, message: str, **kwargs: Any) -> None:
    if kwargs:
        try:
            message = f"{message} | {json.dumps(kwargs, default=str)[:4000]}"
        except (TypeError, ValueError):
            message = f"{message} | {kwargs!r}"
    logger.warning(message)
