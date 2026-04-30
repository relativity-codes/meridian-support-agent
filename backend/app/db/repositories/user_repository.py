from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User


class UserRepository:
    @staticmethod
    async def get_by_id(session: AsyncSession, user_id: uuid.UUID | str) -> User | None:
        key = str(user_id)
        result = await session.execute(select(User).where(User.id == key))
        return result.scalars().first()

    @staticmethod
    async def get_by_google_id(session: AsyncSession, google_id: str) -> User | None:
        result = await session.execute(select(User).where(User.google_id == google_id))
        return result.scalars().first()

    @staticmethod
    async def get_by_email(session: AsyncSession, email: str) -> User | None:
        result = await session.execute(select(User).where(User.email == email))
        return result.scalars().first()

    @staticmethod
    async def create(session: AsyncSession, **kwargs: Any) -> User:
        user = User(**kwargs)
        session.add(user)
        await session.flush()
        await session.refresh(user)
        return user

    @staticmethod
    async def update(session: AsyncSession, user_id: uuid.UUID | str, **kwargs: Any) -> User | None:
        key = str(user_id)
        q = update(User).where(User.id == key).values(**kwargs).returning(User)
        result = await session.execute(q)
        await session.flush()
        return result.scalars().first()

    @staticmethod
    async def delete_by_id(session: AsyncSession, user_id: uuid.UUID | str) -> bool:
        key = str(user_id)
        result = await session.execute(delete(User).where(User.id == key))
        await session.flush()
        return result.rowcount > 0
