from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_auth_me_without_cookie_returns_null_user() -> None:
    with TestClient(app) as client:
        r = client.get("/api/v1/auth/me")
    assert r.status_code == 200
    body = r.json()
    assert body["user"] is None
