import logging
import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import clear_access_cookies, create_access_token, set_access_cookies
from app.db.models.user import User
from app.db.repositories.user_repository import UserRepository
from app.db.session import get_session
from app.schemas.user import UserRead
from app.services.user_service import UserService
from app.utils.logger import log_exception

logger = logging.getLogger(__name__)

router = APIRouter()


class GoogleLoginRequest(BaseModel):
    id_token: str


class AuthMeResponse(BaseModel):
    """Session probe: always 200 so bootstrapping does not spam 401 in access logs."""

    user: UserRead | None = None


def _user_to_read(row: User) -> UserRead:
    return UserRead(
        id=str(row.id),
        google_id=row.google_id,
        email=row.email,
        name=row.name,
        avatar_url=row.avatar_url,
    )


@router.get("/auth/me", response_model=AuthMeResponse)
async def auth_me(request: Request, session: AsyncSession = Depends(get_session)) -> AuthMeResponse:
    raw = request.cookies.get("access_token")
    if not raw:
        return AuthMeResponse(user=None)

    try:
        payload = jwt.decode(raw, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            return AuthMeResponse(user=None)
    except jwt.PyJWTError:
        return AuthMeResponse(user=None)

    try:
        uid = uuid.UUID(str(sub))
    except ValueError:
        return AuthMeResponse(user=None)
    row = await UserRepository.get_by_id(session, uid)
    if row is None:
        return AuthMeResponse(user=None)
    return AuthMeResponse(user=_user_to_read(row))


@router.post("/auth/google")
async def auth_google(
    login_request: GoogleLoginRequest,
    session: AsyncSession = Depends(get_session),
) -> JSONResponse:
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GOOGLE_CLIENT_ID is not configured",
        )
    try:
        id_info = id_token.verify_oauth2_token(
            login_request.id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        logger.warning("Google token verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google ID token: {e}",
        ) from e
    except Exception as e:
        log_exception(logger, e, context="Google OAuth login unexpected failure")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error during Google authentication",
        ) from e

    user = await UserService.get_or_create_user_from_google(session, id_info)
    token = create_access_token(str(user.id))
    payload = _user_to_read(user).model_dump()
    out = JSONResponse(content=payload, status_code=status.HTTP_200_OK)
    set_access_cookies(out, token)
    return out


@router.post("/auth/logout")
async def logout(response: Response) -> dict[str, bool]:
    clear_access_cookies(response)
    return {"ok": True}
