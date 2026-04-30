"""HTTP request/response logging middleware."""

from __future__ import annotations

import logging
import time
from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


class RequestLogMiddleware(BaseHTTPMiddleware):
    """Log each request with method, path, status, duration, client, and Origin (for CORS debugging)."""

    async def dispatch(self, request: Request, call_next: Callable[[Request], Response]) -> Response:
        start = time.perf_counter()
        client = request.client.host if request.client else "-"
        origin = request.headers.get("origin", "-")
        path = request.url.path
        method = request.method
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - start) * 1000
            logger.exception(
                "request_error method=%s path=%s client=%s origin=%s elapsed_ms=%.1f",
                method,
                path,
                client,
                origin,
                elapsed_ms,
            )
            raise
        elapsed_ms = (time.perf_counter() - start) * 1000
        log_fn = logger.warning if response.status_code >= 400 else logger.info
        log_fn(
            "request method=%s path=%s status=%s client=%s origin=%s elapsed_ms=%.1f",
            method,
            path,
            response.status_code,
            client,
            origin,
            elapsed_ms,
        )
        return response
