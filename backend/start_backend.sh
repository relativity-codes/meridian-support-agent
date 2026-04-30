#!/usr/bin/env bash
# Backend-only dev server from backend/ (mirrors personal-ai-agent/backend/start_backend.sh).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env — edit before production."
fi

if [[ ! -d .venv ]]; then
  uv venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

uv pip install -e . >/dev/null
echo "Starting uvicorn on http://0.0.0.0:8000"
exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
