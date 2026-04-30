#!/usr/bin/env bash
# Bootstrap dependencies then start backend + frontend (same idea as personal-ai-agent/start_project.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

./scripts/bootstrap.sh

cleanup() {
  for pid in $(jobs -p 2>/dev/null); do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

echo "==> Starting backend (0.0.0.0:8000)"
(
  cd backend
  # shellcheck disable=SC1091
  source .venv/bin/activate
  exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
) &

echo "==> Starting frontend (Next dev)"
(
  cd frontend
  exec npm run dev
) &

wait
