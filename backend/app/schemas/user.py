from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    google_id: str | None = None
    email: str
    name: str | None = None
    avatar_url: str | None = None
