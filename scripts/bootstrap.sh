#!/usr/bin/env bash
# Copy env templates and install backend + frontend dependencies (no servers).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Env files"
if [[ ! -f backend/.env ]]; then
  cp backend/.env.example backend/.env
  echo "    Created backend/.env (edit before run)"
fi
if [[ ! -f frontend/.env.local ]]; then
  cp frontend/.env.example frontend/.env.local
  echo "    Created frontend/.env.local"
fi

echo "==> Backend (uv)"
if ! command -v uv &>/dev/null; then
  echo "Install uv: https://docs.astral.sh/uv/getting-started/installation/" >&2
  exit 1
fi
(
  cd backend
  uv venv --allow-existing
  uv pip install -e .
  uv pip install pytest pytest-asyncio
)

echo "==> Frontend (npm)"
(
  cd frontend
  npm install
)

echo "Done."
echo "  Dev (split): ./scripts/start-dev.sh   # set NEXT_PUBLIC_API_URL in frontend/.env.local"
echo "  Static+API:  ./scripts/export-static.sh && (cd backend && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000)"
