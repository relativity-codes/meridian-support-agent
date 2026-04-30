"""
Ensure test env is set before any `app` import (engine binds at first import).
Pytest uses a file SQLite DB by default so CI and ./scripts/ci-local.sh need no Docker DB.
Run pytest with cwd = backend/ (see CI and scripts/ci-local.sh).
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
(_BACKEND_ROOT / "data").mkdir(parents=True, exist_ok=True)
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./data/pytest.db")
os.environ.setdefault("SECRET_KEY", "pytest-secret-key-32-chars-minimum!")
os.environ.setdefault("OPENROUTER_API_KEY", "dummy-not-called-in-health-test")
os.environ.setdefault("GOOGLE_CLIENT_ID", "")


@pytest.fixture(scope="session", autouse=True)
def _init_database_schema() -> None:
    """Create tables before any test so async DB tests do not depend on TestClient lifespan order."""
    from app.db.session import init_db

    asyncio.run(init_db())
