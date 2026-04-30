#!/usr/bin/env bash
# Same flow as personal-ai-agent/build_and_serve.sh: backend venv + deps, env file,
# frontend static export, copy out/ → backend/static/, then start a single uvicorn (API + UI).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "Setting up virtual environment..."
if [[ ! -d backend/.venv ]]; then
  (cd backend && uv venv)
fi
echo "Virtual environment set up."

echo "Installing Backend Dependencies..."
(
  cd backend
  uv pip install -e .
)
echo "Backend dependencies installed."

echo "Setting up Environment Variables..."
if [[ ! -f backend/.env ]]; then
  cp backend/.env.example backend/.env
  echo "backend/.env created."
fi
echo "IMPORTANT: Ensure backend/.env has OPENROUTER_API_KEY, GOOGLE_CLIENT_ID, SECRET_KEY, etc."

echo "Building Frontend..."
(
  cd frontend
  npm install
  npm run build
)
echo "Frontend build complete."

echo "--- Copying Frontend to Backend Static Directory ---"
STATIC_DIR="backend/static"
rm -rf "$STATIC_DIR"
mkdir -p "$STATIC_DIR"
cp -r frontend/out/* "$STATIC_DIR/"
echo "Frontend files copied to $STATIC_DIR."

echo "--- Starting Single-App Server ---"
echo "The application will be available at http://localhost:8000"
cd backend
exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
