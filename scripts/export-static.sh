#!/usr/bin/env bash
# Build Next static export and copy into backend/static/ (same as personal-ai-agent build step).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

(
  cd frontend
  npm install
  npm run build
)

STATIC_DIR="backend/static"
rm -rf "$STATIC_DIR"
mkdir -p "$STATIC_DIR"
cp -r frontend/out/* "$STATIC_DIR/"

echo "Static export copied to $STATIC_DIR (serve with uvicorn from backend/)"
