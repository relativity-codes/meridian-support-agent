from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user, get_session
from app.db.repositories.user_repository import UserRepository
from app.schemas.user import UserRead
from app.utils.validators import parse_uuid

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/me", response_model=UserRead)
async def read_me(
    db: AsyncSession = Depends(get_session),
    user: CurrentUser = Depends(get_current_user),
) -> UserRead:
    uid = parse_uuid(user["user_id"], "user_id")
    row = await UserRepository.get_by_id(db, uid)
    if row is None:
        logger.warning("read_me: user row missing for token user_id=%s", uid)
        raise HTTPException(status_code=404, detail="User not found")
    return UserRead(
        id=str(row.id),
        google_id=row.google_id,
        email=row.email,
        name=row.name,
        avatar_url=row.avatar_url,
    )
