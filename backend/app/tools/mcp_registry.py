from __future__ import annotations

import logging
from typing import Any

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.types import CallToolResult, Tool

logger = logging.getLogger(__name__)


def mcp_tool_to_flat(server_id: str, tool: Tool) -> dict[str, Any]:
    """Shape expected by ReAct ``think`` (matches ``react_loop.md`` tool list)."""
    params: dict[str, Any] = dict(tool.inputSchema) if tool.inputSchema else {}
    return {
        "server_id": server_id,
        "name": tool.name,
        "description": (tool.description or "").strip(),
        "parameters": params,
    }


def call_tool_result_to_jsonable(result: CallToolResult) -> dict[str, Any]:
    """Scratchpad-safe payload for the observe node."""
    return result.model_dump(mode="json")


class McpStreamableHttpToolRegistry:
    """Meridian order/catalog MCP over Streamable HTTP, wired as ``ToolRegistry`` for the ReAct agent."""

    def __init__(self, *, url: str, server_id: str, timeout_seconds: float = 120.0) -> None:
        self._url = url.strip()
        self._server_id = server_id.strip()
        self._timeout = float(timeout_seconds)
        self._tools_cache: list[dict[str, Any]] = []

    def _http_timeout(self) -> httpx.Timeout:
        # Long read for SSE leg of Streamable HTTP; connect uses same ceiling.
        read_cap = max(self._timeout * 2, 300.0)
        return httpx.Timeout(self._timeout, read=read_cap)

    def _http_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(follow_redirects=True, timeout=self._http_timeout())

    async def initialize(self) -> None:
        if not self._url:
            logger.warning("McpStreamableHttpToolRegistry: empty URL, no tools")
            self._tools_cache = []
            return

        async with self._http_client() as http_client:
            async with streamable_http_client(self._url, http_client=http_client) as (
                read_stream,
                write_stream,
                _,
            ):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    listed = await session.list_tools()

        self._tools_cache = [mcp_tool_to_flat(self._server_id, t) for t in listed.tools]
        logger.info(
            "MCP tools loaded url=%s server_id=%s count=%s names=%s",
            self._url,
            self._server_id,
            len(self._tools_cache),
            [t["name"] for t in self._tools_cache],
        )

    async def list_tools_flat(self) -> list[dict[str, Any]]:
        return list(self._tools_cache)

    async def invoke_tool(
        self,
        server_id: str,
        tool_name: str,
        arguments: dict[str, Any],
        user_id: str | None = None,
    ) -> Any:
        _ = user_id
        if server_id != self._server_id:
            return {
                "error": "unknown_server",
                "message": f"No MCP server registered for server_id={server_id!r}",
                "expected_server_id": self._server_id,
            }

        args = dict(arguments or {})
        async with self._http_client() as http_client:
            async with streamable_http_client(self._url, http_client=http_client) as (
                read_stream,
                write_stream,
                _,
            ):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    result = await session.call_tool(tool_name, args)

        return call_tool_result_to_jsonable(result)
