# meridian-support-agent backend

FastAPI service: Google Sign-In, LangGraph ReAct loop, OpenRouter, pluggable `ToolRegistry` (default: `NullToolRegistry`).

Run:

```bash
cp .env.example .env
uv sync  # or: pip install -e .
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
