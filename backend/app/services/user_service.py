from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User
from app.db.repositories.user_repository import UserRepository
from app.utils.logger import log_exception

logger = logging.getLogger(__name__)


class UserService:
    @staticmethod
    async def get_or_create_user_from_google(session: AsyncSession, google_user_info: dict[str, Any]) -> User:
        user = await UserRepository.get_by_google_id(session, google_user_info["sub"])
        if not user:
            user = await UserRepository.get_by_email(session, google_user_info["email"])
            if user:
                updated = await UserRepository.update(session, user.id, google_id=google_user_info["sub"])
                user = updated or user
            else:
                user = await UserRepository.create(
                    session,
                    google_id=google_user_info["sub"],
                    email=google_user_info["email"],
                    name=google_user_info.get("name"),
                    avatar_url=google_user_info.get("picture"),
                )
        try:
            await session.commit()
        except Exception as exc:
            log_exception(
                logger,
                exc,
                context="UserService.get_or_create_user_from_google commit failed",
                extra_data={"google_sub": google_user_info.get("sub"), "email": google_user_info.get("email")},
            )
            raise
        return user
