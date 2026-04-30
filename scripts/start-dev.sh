#!/usr/bin/env bash
# Run backend (8000) and frontend (3000) together. Ctrl+C stops both.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -d backend/.venv ]]; then
  echo "Run ./scripts/bootstrap.sh first" >&2
  exit 1
fi

cleanup() {
  for pid in $(jobs -p 2>/dev/null); do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

echo "==> Backend http://127.0.0.1:8000"
(
  cd backend
  # shellcheck disable=SC1091
  source .venv/bin/activate
  exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
) &

echo "==> Frontend http://127.0.0.1:3000  (set NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 in frontend/.env.local)"
(
  cd frontend
  exec npm run dev
) &

wait
