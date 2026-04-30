import json
import os
import ssl
from typing import Any
from urllib.parse import urlparse

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _parse_env_list(value: str, fallback: list[str]) -> list[str]:
    s = (value or "").strip()
    if not s:
        return list(fallback)
    if s.startswith("["):
        parsed = json.loads(s)
        if isinstance(parsed, list):
            return [str(x).strip() for x in parsed if str(x).strip()]
        return list(fallback)
    return [x.strip() for x in s.split(",") if x.strip()]


def _merge_host_cors(origins: list[str], host_url: str) -> list[str]:
    """Append API ``HOST`` origin(s) so same-origin static + loopback aliases work without duplicating env."""
    out = list(origins)
    u = urlparse((host_url or "").strip())
    if not u.scheme or not u.netloc:
        return out
    primary = f"{u.scheme}://{u.netloc}"
    if primary not in out:
        out.append(primary)
    host, port = u.hostname, u.port
    if host and port:
        alt_host = "127.0.0.1" if host == "localhost" else "localhost" if host == "127.0.0.1" else None
        if alt_host:
            alt = f"{u.scheme}://{alt_host}:{port}"
            if alt not in out:
                out.append(alt)
    return out


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    APP_NAME: str = "meridian-support-agent"
    APP_ENV: str = "development"
    DEBUG: bool = True

    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    SECURE_COOKIES: bool = False

    HOST: str = "http://localhost:8000"
    CORS_ORIGINS: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:8000,http://127.0.0.1:8000"
    )
    ALLOWED_HOSTS: str = "localhost,127.0.0.1,test,*"

    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://user:password@localhost:5432/meridian_support",
        description=(
            "Async SQLAlchemy URL. Use postgresql+asyncpg:// for PostgreSQL or CockroachDB "
            "(Cockroach Cloud: port 26257, database defaultdb). "
            "Do not rely on URL query params for TLS with asyncpg; use POSTGRES_SSL_* below."
        ),
    )
    #: Force TLS off (local insecure nodes only). Ignored when ``DATABASE_URL`` is SQLite.
    DATABASE_SSL_DISABLE: bool = False
    #: Cockroach Cloud / Postgres: ``verify-full``, ``verify-ca``, ``require``, or ``disable``.
    POSTGRES_SSL_MODE: str | None = None
    #: Path to CA bundle (e.g. ``.postgresql/root.crt``). Relative paths are resolved from ``backend/``.
    POSTGRES_SSL_ROOT_CERT: str | None = None

    GOOGLE_CLIENT_ID: str = ""

    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_DEFAULT_MODEL: str = "openai/gpt-4o-mini"

    MAX_REACT_ITERATIONS: int = 8

    #: Streamable HTTP MCP server (e.g. Meridian order service). Empty disables MCP tools.
    MCP_SERVER_URL: str = ""
    #: Value the model must use as ``action.server_id`` for tools from ``MCP_SERVER_URL``.
    MCP_SERVER_ID: str = "meridian_orders"
    #: httpx read/connect budget for MCP Streamable HTTP (Cloud Run cold starts).
    MCP_HTTP_TIMEOUT_SECONDS: float = 120.0

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def database_url_asyncpg_driver(cls, v: object) -> object:
        """
        Bare ``postgresql://`` (and ``postgres://``) map to the sync psycopg2 dialect, which this
        project does not install. Normalize to ``postgresql+asyncpg://`` so ``create_async_engine``
        uses asyncpg.
        """
        if not isinstance(v, str):
            return v
        s = v.strip()
        if not s or s.startswith("sqlite"):
            return s
        if s.startswith("postgres://"):
            return "postgresql+asyncpg://" + s[len("postgres://") :]
        if s.startswith("postgresql://"):
            return "postgresql+asyncpg://" + s[len("postgresql://") :]
        return s

    @property
    def cors_origins_list(self) -> list[str]:
        base = _parse_env_list(
            self.CORS_ORIGINS,
            [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:8000",
                "http://127.0.0.1:8000",
            ],
        )
        return _merge_host_cors(base, self.HOST)

    @property
    def allowed_hosts_list(self) -> list[str]:
        return _parse_env_list(self.ALLOWED_HOSTS, ["localhost", "127.0.0.1", "test", "*"])

    @property
    def postgres_ssl_root_cert_resolved(self) -> str | None:
        """Absolute path to CA file; relative values are resolved from the backend package root."""
        raw = (self.POSTGRES_SSL_ROOT_CERT or "").strip()
        if not raw:
            return None
        if os.path.isabs(raw):
            return raw
        backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.normpath(os.path.join(backend_root, raw))

    @property
    def DATABASE_CONNECT_ARGS(self) -> dict[str, Any]:
        """
        asyncpg ``connect_args`` for TLS (same approach as personal-ai-agent / Cockroach Cloud).

        Certificate verification must use a Python ``SSLContext`` (``cafile``), not URL query params.
        """
        if self.DATABASE_URL.startswith("sqlite"):
            return {}
        if self.DATABASE_SSL_DISABLE:
            return {"ssl": False}

        ssl_mode = (self.POSTGRES_SSL_MODE or "").strip().lower()
        ssl_root = self.postgres_ssl_root_cert_resolved

        if ssl_root:
            context = ssl.create_default_context(cafile=ssl_root)
            if ssl_mode == "require":
                # TLS without verifying server certificate chain
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
            return {"ssl": context}

        if ssl_mode and ssl_mode != "disable":
            return {"ssl": True}

        return {}


settings = Settings()

if settings.DATABASE_URL.startswith("sqlite"):
    path = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "")
    if path and not path.startswith(":memory:"):
        dirpath = os.path.dirname(os.path.abspath(path))
        if dirpath:
            os.makedirs(dirpath, exist_ok=True)
