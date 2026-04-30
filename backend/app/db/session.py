from __future__ import annotations

import logging
import re
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.dialects.postgresql.base import PGDialect
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.utils.logger import log_exception

logger = logging.getLogger(__name__)


def _install_cockroach_version_parser() -> None:
    """
    Teach SQLAlchemy's PostgreSQL dialect to parse CockroachDB version strings.

    Cockroach responds to ``select pg_catalog.version()`` with strings like
    ``CockroachDB CCL v25.4.8 (...)``, which SQLAlchemy's default parser rejects.
    """
    if getattr(PGDialect, "_meridian_support_cockroach_patch", False):
        return

    original_get_server_version_info = PGDialect._get_server_version_info

    def _patched_get_server_version_info(self, connection):  # type: ignore[no-untyped-def]
        try:
            return original_get_server_version_info(self, connection)
        except AssertionError:
            pass

        version = connection.exec_driver_sql("select pg_catalog.version()").scalar()
        version_text = str(version)
        cockroach_match = re.search(
            r"CockroachDB(?:\s+CCL)?\s+v(\d+)(?:\.(\d+))?(?:\.(\d+))?",
            version_text,
        )
        if cockroach_match:
            major, minor, patch = cockroach_match.group(1, 2, 3)
            return (int(major), int(minor or 0), int(patch or 0))

        raise AssertionError(f"Could not determine version from string '{version_text}'")

    PGDialect._get_server_version_info = _patched_get_server_version_info
    PGDialect._meridian_support_cockroach_patch = True


_install_cockroach_version_parser()

engine = create_async_engine(
    settings.DATABASE_URL,
    connect_args=settings.DATABASE_CONNECT_ARGS,
    echo=settings.DEBUG,
    future=True,
)

async_session_factory = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


@asynccontextmanager
async def async_session_scope() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


async def db_health() -> str:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return "connected"
    except Exception as exc:
        log_exception(logger, exc, context="db_health check failed")
        return f"error: {exc}"


async def init_db() -> None:
    from app.db.models.base import Base

    import app.db.models  # noqa: F401

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:
        log_exception(logger, exc, context="init_db create_all failed")
        return


async def close_db() -> None:
    await engine.dispose()
