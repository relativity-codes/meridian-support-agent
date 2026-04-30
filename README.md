# meridian-support-agent

Minimal **Think → Act → Observe** agent stack: **Next.js 14**, **FastAPI**, **LangGraph**, **OpenRouter**, **Google Sign-In** (JWT cookie), **SQLAlchemy** with **PostgreSQL or CockroachDB** via `**asyncpg`** (`postgresql+asyncpg://…`). Point `DATABASE_URL` at your own database (local install, managed cloud, etc.). **Pytest / CI** use **SQLite** by default (no database container in this repo).

**Docker in this repo:** the **[Dockerfile](Dockerfile)** is **only** for **building the production image** and **deploying to Google Cloud Run** (CI `docker/build-push-action`, Artifact Registry, then Cloud Run). Local development uses **uv** + **uvicorn** and/or **Next.js** directly—not Docker.

MCP / tools are behind a `ToolRegistry` interface; the default is `**NullToolRegistry`** (empty tool list). Swap in a real registry when you connect an MCP server—see [backend/app/tools/registry.py](backend/app/tools/registry.py).

**Auth (Google):** `POST /api/v1/auth/google` sets an httpOnly `access_token` cookie; `**GET /api/v1/auth/me`** returns `{ "user": null }` or the signed-in user (always 200) so the UI can restore sessions without logging **401** on every cold load; `**GET /api/v1/users/me`** remains for a strict profile fetch behind the cookie middleware. `**AuthMiddleware**` enforces the cookie on `/api/*` except `/api/v1/auth/*`; the UI uses `**apiFetch**` + `**useAuth**` (Zustand) and **Sign out** calls `POST /api/v1/auth/logout`. The **home route `/`** is the **login page**; if a session exists, the app **redirects to `/chat/`**.

**Chat:** conversations are stored in the database (`chat_conversations`, `chat_messages`). Use `**POST /api/v1/chat/conversations`** to open a new thread, `**GET /api/v1/chat/conversations**` to list them, `**GET /api/v1/chat/conversations/{id}/messages**` to load history, and `**POST /api/v1/chat/**` to send a message (optional `conversation_id` in the body).

## Quick start

### Backend

```bash
cd backend
cp .env.example .env
# DATABASE_URL=postgresql+asyncpg://… (see .env.example). For Cockroach Cloud TLS:
#   Put CA in backend/.postgresql/root.crt, set POSTGRES_SSL_MODE=verify-full, POSTGRES_SSL_ROOT_CERT=.postgresql/root.crt
#   (do not use sslmode/sslrootcert on the URL—TLS is applied via connect_args.)
# Local insecure Cockroach/Postgres: DATABASE_SSL_DISABLE=true
# Set GOOGLE_CLIENT_ID, OPENROUTER_API_KEY, SECRET_KEY
uv venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
uv pip install -e .
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
# NEXT_PUBLIC_GOOGLE_CLIENT_ID must match backend GOOGLE_CLIENT_ID (Web client)
npm install
npm run dev
```

The frontend uses `**output: "export"**`: `npm run build` writes to `frontend/out/`. Copy that tree into `**backend/static/**` and run **uvicorn from `backend/`** so the API and UI share one origin (cookies work without CORS tricks).

- **Same-origin (recommended):** leave `NEXT_PUBLIC_API_URL` empty, run `./scripts/export-static.sh` (build + copy only) or `**./build_and_serve.sh`** (build, copy, then **starts uvicorn** on `:8000`), then open `http://127.0.0.1:8000/`.
- `**next dev` on :3000:** set `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` in `frontend/.env.local` so fetches hit the API (static export does not use Next rewrites).

## Bash scripts


| Script                                               | Purpose                                                                                                                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [scripts/bootstrap.sh](scripts/bootstrap.sh)         | Copy `.env` templates, `uv` + `npm install` (no servers).                                                                                                |
| [scripts/start-dev.sh](scripts/start-dev.sh)         | Backend `:8000` + Next dev `:3000` (run after bootstrap).                                                                                                |
| [scripts/ci-local.sh](scripts/ci-local.sh)           | Same checks as CI: `pytest` (SQLite under `backend/data/`) + `npm run build`. No Docker (see note above).                                                |
| [scripts/export-static.sh](scripts/export-static.sh) | `npm run build` then copy `frontend/out/` → `backend/static/`.                                                                                           |
| [start_project.sh](start_project.sh)                 | Bootstrap then start backend + frontend.                                                                                                                 |
| [build_and_serve.sh](build_and_serve.sh)             | Venv, backend install, `.env`, `npm install` + `npm run` build, copy `frontend/out/` → `backend/static/`, then `**exec uvicorn`** (single app on :8000). |
| [backend/start_backend.sh](backend/start_backend.sh) | Backend-only dev server from `backend/`.                                                                                                                 |


Requires [uv](https://docs.astral.sh/uv/) and Node 18+ / npm.

## CI/CD and Cloud Run (GCP)

The [Dockerfile](Dockerfile) exists **solely** to produce the **Cloud Run** image: multi-stage Next static export → `/app/static`, then FastAPI on `$PORT` (8080 on Cloud Run). PR/push workflows **build that image**; deploy pushes it to Artifact Registry and updates Cloud Run when configured.


| Workflow                                                                                      | When                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[.github/workflows/ci.yml](.github/workflows/ci.yml)`                                        | **Git root** here: `pytest`, frontend lint + static export, **container image build** (Dockerfile → Cloud Run path), **deploy** on non-PR when `GCP_PROJECT_ID` is set. |
| `[.github/workflows/meridian-support-agent-ci.yml](../.github/workflows/meridian-support-agent-ci.yml)` | **Monorepo** root: same jobs with `meridian-support-agent/` paths; Docker **build context** is `meridian-support-agent` for the same Cloud Run image.                             |


**Deploy is skipped** until you add repository **Variables** (Settings → Secrets and variables → Actions → Variables), at minimum `GCP_PROJECT_ID`. Use **Workload Identity Federation** (`google-github-actions/auth@v2`) so GitHub Actions can push to Artifact Registry and deploy Cloud Run without long-lived JSON keys—configure a WIF provider and a deployer service account in GCP, then set `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT` in the workflow variables.

### GitHub Actions variables (suggested)


| Variable                         | Purpose                                                           |
| -------------------------------- | ----------------------------------------------------------------- |
| `GCP_PROJECT_ID`                 | Enables deploy job when non-empty                                 |
| `GCP_REGION`                     | e.g. `europe-west1`                                               |
| `GAR_REPOSITORY`                 | Artifact Registry Docker repo name                                |
| `CLOUD_RUN_SERVICE`              | Cloud Run service name                                            |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | WIF provider resource name                                        |
| `GCP_SERVICE_ACCOUNT`            | Deployer service account email                                    |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`   | Baked into static export at image build (Web client ID)           |
| `GOOGLE_CLIENT_ID`               | Backend verifies Google ID tokens (often same as `NEXT_PUBLIC_`*) |
| `HOST`                           | Public URL, e.g. `https://your-service.run.app`                   |
| `CORS_ORIGINS`                   | Comma list; include your Cloud Run URL                            |
| `ALLOWED_HOSTS`                  | Include `*` or your Run hostname                                  |
| `APP_NAME`                       | Display name (default **Meridian Support**); `/health`, OpenRouter `X-Title` |
| `OPENROUTER_BASE_URL`            | Default `https://openrouter.ai/api/v1`                            |
| `OPENROUTER_DEFAULT_MODEL`       | e.g. `openai/gpt-4o-mini`                                         |
| `MAX_REACT_ITERATIONS`           | Optional cap                                                      |


### GitHub Actions secrets


| Secret               | Purpose                                        |
| -------------------- | ---------------------------------------------- |
| `DATABASE_URL`       | Production DB, e.g. `postgresql+asyncpg://...` |
| `SECRET_KEY`         | JWT signing                                    |
| `OPENROUTER_API_KEY` | LLM calls                                      |


## Layout


| Path                                                                                     | Role                                                               |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [Dockerfile](Dockerfile)                                                                 | **Cloud Run only** — production container (Next export + FastAPI). |
| [backend/app/agents/react_graph.py](backend/app/agents/react_graph.py)                   | LangGraph: `think` → (`act` → `observe`) → `END`                   |
| [backend/system_prompts/react/react_loop.md](backend/system_prompts/react/react_loop.md) | ReAct JSON contract for the model                                  |
| [frontend/components/auth/SignIn.tsx](frontend/components/auth/SignIn.tsx)               | `@react-oauth/google` → `POST /api/v1/auth/google`                 |


## Adding MCP later

1. Implement `ToolRegistry` (`initialize`, `list_tools_flat`, `invoke_tool`).
2. Register it on `app.state.tool_registry` in [backend/app/main.py](backend/app/main.py) instead of (or wrapping) `NullToolRegistry`.
3. No change required to graph routing—the **think** node always injects the live tool list into the system prompt.

