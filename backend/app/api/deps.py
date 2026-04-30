from __future__ import annotations

import logging
from typing import Annotated, TypedDict

import jwt
from fastapi import Depends, Header, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.repositories.user_repository import UserRepository
from app.db.session import async_session_factory, get_session
from app.utils.logger import log_exception
from app.utils.validators import parse_bearer_token, parse_uuid

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser(TypedDict, total=False):
    user_id: str
    google_id: str
    email: str
    name: str | None
    avatar_url: str | None


async def get_current_user(
    request: Request,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
    db: AsyncSession = Depends(get_session),
) -> CurrentUser:
    raw = request.cookies.get("access_token")
    if not raw:
        raw = parse_bearer_token(authorization) or (creds.credentials if creds else None)

    if not raw:
        raise HTTPException(status_code=401, detail="Missing authentication token")

    try:
        payload = jwt.decode(raw, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token: missing sub")
    except HTTPException:
        raise
    except jwt.PyJWTError as exc:
        logger.warning("get_current_user JWT invalid: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid or expired session token") from exc
    except Exception as exc:
        log_exception(
            logger,
            exc,
            context="Unexpected error decoding JWT in get_current_user",
            extra_data={"hint": "non-JWT error during decode"},
        )
        raise HTTPException(status_code=401, detail="Invalid or expired session token") from exc

    user = await UserRepository.get_by_id(db, parse_uuid(str(user_id), "user_id"))
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return {
        "user_id": str(user.id),
        "google_id": user.google_id or "",
        "email": user.email,
        "name": user.name,
        "avatar_url": user.avatar_url,
    }


SessionDep = Annotated[AsyncSession, Depends(get_session)]
get_db = get_session
