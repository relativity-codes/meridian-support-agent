from datetime import datetime, timedelta

import jwt
from fastapi import Response

from app.config import settings


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def set_access_cookies(response: Response, token: str) -> None:
    max_age = int(settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    response.set_cookie(
        key="access_token",
        value=token,
        max_age=max_age,
        httponly=True,
        secure=settings.SECURE_COOKIES,
        samesite="lax",
        path="/",
    )


def clear_access_cookies(response: Response) -> None:
    response.delete_cookie(
        key="access_token",
        path="/",
        secure=settings.SECURE_COOKIES,
        httponly=True,
        samesite="lax",
    )
