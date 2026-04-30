from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_users_me_without_cookie_returns_401() -> None:
    with TestClient(app) as client:
        r = client.get("/api/v1/users/me")
    assert r.status_code == 401
