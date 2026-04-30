# Cloud Run deployment image only (not used for local dev).
# Multi-stage: Next static export → /app/static, then FastAPI on $PORT (same layout idea as personal-ai-agent).
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}

# Use npm + package-lock.json (same as GitHub Actions) so the image matches CI and avoids stale yarn.lock.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


FROM python:3.11-slim AS backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY backend/pyproject.toml backend/README.md ./
COPY backend/app ./app
COPY backend/system_prompts ./system_prompts

RUN uv venv && uv pip install --no-cache-dir -e .

COPY --from=frontend-builder /app/frontend/out ./static

EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
