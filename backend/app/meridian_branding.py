"""
Meridian Electronics — customer support prototype backend.

User-facing strings for OpenAPI and logs. Product behavior is driven by
``system_prompts/react/react_loop.md`` and optional MCP tools (``MCP_SERVER_URL``).
"""

API_TITLE = "Meridian Support API"

API_DESCRIPTION = """
**Meridian Electronics** internal customer-support prototype.

- **Auth:** Google Sign-In for authorized preview users (staff / engineering).
- **Chat:** Conversational assistant using a ReAct loop (think → act → observe) via OpenRouter.
- **Business data:** When ``MCP_SERVER_URL`` is set, the assistant can call your Streamable HTTP
  MCP server (e.g. orders and catalog) instead of touching databases directly.

Monitors, keyboards, printers, networking gear, and accessories — see the system prompt for tone
and guardrails.
""".strip()
