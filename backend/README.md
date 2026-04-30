# Meridian Support — backend

FastAPI service for the **Meridian Electronics** internal customer-support prototype: **Google Sign-In** (authorized preview users), **LangGraph** ReAct loop (think → act → observe) with **OpenRouter**, persisted chat, and a pluggable **`ToolRegistry`**.

- **Default tools:** empty (`NullToolRegistry`) until you set environment variables.
- **Meridian order / catalog MCP:** set `MCP_SERVER_URL` to your Streamable HTTP endpoint (see `.env.example`). The assistant then receives live tool definitions from that server.

## Quick run

```bash
cp .env.example .env
# Set GOOGLE_CLIENT_ID, OPENROUTER_API_KEY, SECRET_KEY, DATABASE_URL (or SQLite for local tests)
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

OpenAPI docs: `/docs` (title **Meridian Support API**).
