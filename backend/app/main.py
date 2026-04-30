from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.middleware import AuthMiddleware
from app.api.request_logging import RequestLogMiddleware
from app.api.routers.v1 import auth, chat, users
from app.config import settings
from app.core.openrouter import OpenRouterClient
from app.db.session import close_db, init_db
from app.tools.mcp_registry import McpStreamableHttpToolRegistry
from app.tools.registry import NullToolRegistry
from app.utils.logger import log_exception

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    app.state.openrouter = OpenRouterClient(
        api_key=settings.OPENROUTER_API_KEY or None,
        base_url=settings.OPENROUTER_BASE_URL,
    )
    mcp_url = (settings.MCP_SERVER_URL or "").strip()
    if mcp_url:
        reg = McpStreamableHttpToolRegistry(
            url=mcp_url,
            server_id=(settings.MCP_SERVER_ID or "meridian_orders").strip(),
            timeout_seconds=settings.MCP_HTTP_TIMEOUT_SECONDS,
        )
    else:
        reg = NullToolRegistry()
    await reg.initialize()
    app.state.tool_registry = reg
    logger.info("startup complete (ReAct kit)")
    yield
    await close_db()
    logger.info("shutdown complete")


app = FastAPI(
    title="meridian-support-agent API",
    version="0.1.0",
    description="ReAct loop (Think–Act–Observe) with pluggable tools",
    lifespan=lifespan,
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    logger.warning(
        "request_validation_error path=%s method=%s errors=%s",
        request.url.path,
        request.method,
        exc.errors(),
    )
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    log_exception(
        logger,
        exc,
        context="Unhandled exception",
        extra_data={"path": request.url.path, "method": request.method},
    )
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# CORSMiddleware last = outermost: every response (including middleware 401s) gets CORS headers;
# preflight OPTIONS is handled before inner auth.
app.add_middleware(AuthMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts_list)
app.add_middleware(RequestLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])


@app.get("/health")
async def health() -> dict:
    from app.db.session import db_health

    return {
        "status": "ok",
        "database": await db_health(),
        "app": settings.APP_NAME,
    }


# ---------------------------------------------------------------------------
# Static frontend (Next.js `output: "export"` → copy `frontend/out/` → static/)
# ---------------------------------------------------------------------------


@app.get("/{full_path:path}", tags=["Frontend"])
async def serve_frontend(full_path: str):
    """
    Serve exported Next assets from ./static (relative to process cwd, usually backend/).

    - Existing files (e.g. /_next/static/...) are returned as-is.
    - Directories with index.html (trailingSlash export) are supported.
    - Otherwise fall back to /static/index.html for client-side routing.
    """
    static_file_path = os.path.join("static", full_path)

    if os.path.isfile(static_file_path):
        return FileResponse(static_file_path)

    if os.path.isdir(static_file_path):
        dir_index = os.path.join(static_file_path, "index.html")
        if os.path.isfile(dir_index):
            return FileResponse(dir_index)

    index_path = os.path.join("static", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)

    return {
        "message": "meridian-support-agent API is running. Static UI not found — run ./build_and_serve.sh or ./scripts/export-static.sh and serve from backend/.",
        "hint": "next build (export) then copy frontend/out/* to backend/static/",
    }
