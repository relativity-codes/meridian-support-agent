#!/usr/bin/env bash
# Mirror CI locally: backend pytest + frontend lint/build.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export SECRET_KEY="${SECRET_KEY:-ci-local-secret-key-change-me-32b}"
export OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}"
export GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"

echo "==> Backend tests (cwd backend/, SQLite unless DATABASE_URL is set)"
(
  cd backend
  mkdir -p data
  export DATABASE_URL="${DATABASE_URL:-sqlite+aiosqlite:///./data/ci-local.db}"
  if [[ ! -d .venv ]]; then uv venv; fi
  # shellcheck disable=SC1091
  source .venv/bin/activate
  uv pip install -e . pytest pytest-asyncio >/dev/null
  pytest -q
)

echo "==> Frontend lint + build"
(
  cd frontend
  npm run lint
  npm run build
)

echo "ci-local: OK"
