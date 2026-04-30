"""Server-side check that access_token cookie + /auth/me match (no Google required)."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.repositories.user_repository import UserRepository
from app.db.session import async_session_factory
from app.main import app


@pytest.mark.asyncio
async def test_auth_me_returns_user_when_access_token_cookie_valid() -> None:
    email = f"cookie-{uuid.uuid4().hex}@test.local"
    async with async_session_factory() as session:
        user = await UserRepository.create(
            session,
            google_id=f"g-{uuid.uuid4().hex}",
            email=email,
            name="Cookie Test",
        )
        await session.commit()
        uid = str(user.id)

    token = create_access_token(uid)
    with TestClient(app) as client:
        client.cookies.set("access_token", token)
        r = client.get("/api/v1/auth/me")

    assert r.status_code == 200
    body = r.json()
    assert body["user"] is not None
    assert body["user"]["email"] == email


def test_auth_google_response_includes_set_cookie_header(monkeypatch) -> None:
    """Login returns JSON on one Response so Set-Cookie is attached to the outgoing message."""
    from app.config import settings

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "dummy.apps.googleusercontent.com")

    sub = f"sub-{uuid.uuid4().hex}"
    email = f"oauth-{uuid.uuid4().hex}@test.local"

    def fake_verify(_token, _request, _audience):
        return {"sub": sub, "email": email, "name": "OAuth"}

    import app.api.routers.v1.auth as auth_mod

    monkeypatch.setattr(auth_mod.id_token, "verify_oauth2_token", fake_verify)

    with TestClient(app) as client:
        r = client.post(
            "/api/v1/auth/google",
            json={"id_token": "fake-jwt-for-test"},
        )

    assert r.status_code == 200
    sc = r.headers.get("set-cookie") or ""
    assert "access_token=" in sc.lower()
