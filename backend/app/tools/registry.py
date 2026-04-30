from __future__ import annotations

import logging
from typing import Any, Protocol, runtime_checkable

logger = logging.getLogger(__name__)


@runtime_checkable
class ToolRegistry(Protocol):
    async def initialize(self) -> None: ...

    async def list_tools_flat(self) -> list[dict[str, Any]]:
        """Flat list of tools for the LLM: server_id, name, description, parameters."""
        ...

    async def invoke_tool(
        self,
        server_id: str,
        tool_name: str,
        arguments: dict[str, Any],
        user_id: str | None = None,
    ) -> Any:
        ...


class NullToolRegistry:
    """No MCP servers; ReAct loop can still reason and answer without tools."""

    async def initialize(self) -> None:
        return

    async def list_tools_flat(self) -> list[dict[str, Any]]:
        return []

    async def invoke_tool(
        self,
        server_id: str,
        tool_name: str,
        arguments: dict[str, Any],
        user_id: str | None = None,
    ) -> Any:
        logger.info("NullToolRegistry.invoke_tool called server=%s tool=%s", server_id, tool_name)
        return {"error": "no_tools_configured", "message": "No MCP tools are registered in this kit yet."}
