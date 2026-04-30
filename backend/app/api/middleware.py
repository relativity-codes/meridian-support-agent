import logging
from typing import Awaitable, Callable

import jwt
from fastapi import Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app.config import settings
from app.db.repositories.user_repository import UserRepository
from app.db.session import async_session_factory
from app.utils.logger import log_exception
from app.utils.validators import parse_uuid

logger = logging.getLogger(__name__)


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Require cookie JWT for /api/* except auth routes and public paths (mirrors personal-ai-agent).
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)
        path = request.url.path
        allowed_prefixes = ("/api/v1/auth",)
        allowed_paths = {"/health", "/docs", "/redoc", "/openapi.json"}

        if (
            not path.startswith("/api")
            or any(path.startswith(prefix) for prefix in allowed_prefixes)
            or path in allowed_paths
            or any(path.endswith(ext) for ext in (".css", ".js", ".png", ".jpg", ".jpeg", ".svg", ".ico", ".woff", ".woff2"))
        ):
            return await call_next(request)

        access_token = request.cookies.get("access_token")
        if not access_token:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Not authenticated, Please login again"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        try:
            payload = jwt.decode(access_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id = payload.get("sub")
            if user_id is None:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Invalid token, Please login again"},
                )
        except jwt.PyJWTError as e:
            logger.warning("JWT decode failed in AuthMiddleware: %s", e)
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid token, Please login again"},
            )

        async with async_session_factory() as session:
            try:
                uid = parse_uuid(str(user_id), "user_id")
                row = await UserRepository.get_by_id(session, uid)
                if not row:
                    logger.warning("User %s from token not found in database", user_id)
                    return JSONResponse(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        content={"detail": "User not found"},
                    )
                request.state.user = row
            except Exception as e:
                log_exception(
                    logger,
                    e,
                    context="AuthMiddleware user lookup failed",
                    extra_data={"path": path, "user_id": str(user_id)},
                )
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Authentication failed"},
                )

        return await call_next(request)
