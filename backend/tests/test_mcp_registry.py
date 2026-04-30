from __future__ import annotations

import os

import pytest
from mcp.types import CallToolResult, TextContent, Tool

from app.tools.mcp_registry import (
    McpStreamableHttpToolRegistry,
    call_tool_result_to_jsonable,
    mcp_tool_to_flat,
)


def test_mcp_tool_to_flat() -> None:
    tool = Tool(
        name="check_stock",
        description="Stock levels",
        inputSchema={"type": "object", "properties": {"sku": {"type": "string"}}},
    )
    flat = mcp_tool_to_flat("meridian_orders", tool)
    assert flat == {
        "server_id": "meridian_orders",
        "name": "check_stock",
        "description": "Stock levels",
        "parameters": {"type": "object", "properties": {"sku": {"type": "string"}}},
    }


def test_mcp_tool_to_flat_empty_description() -> None:
    tool = Tool(name="x", description=None, inputSchema={"type": "object"})
    flat = mcp_tool_to_flat("s", tool)
    assert flat["description"] == ""


def test_call_tool_result_to_jsonable() -> None:
    result = CallToolResult(content=[TextContent(type="text", text="ok")], isError=False)
    d = call_tool_result_to_jsonable(result)
    assert d["isError"] is False
    assert len(d["content"]) == 1
    assert d["content"][0]["type"] == "text"
    assert d["content"][0]["text"] == "ok"


@pytest.mark.asyncio
async def test_invoke_tool_rejects_unknown_server_id() -> None:
    reg = McpStreamableHttpToolRegistry(
        url="http://127.0.0.1:9/mcp",
        server_id="meridian_orders",
        timeout_seconds=1.0,
    )
    out = await reg.invoke_tool("wrong_server", "any_tool", {})
    assert out["error"] == "unknown_server"
    assert out["expected_server_id"] == "meridian_orders"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_remote_mcp_initialize_lists_tools() -> None:
    if os.environ.get("RUN_MCP_INTEGRATION") != "1":
        pytest.skip("set RUN_MCP_INTEGRATION=1 to call the Meridian order MCP host")
    url = os.environ.get(
        "MCP_SERVER_URL",
        "https://order-mcp-74afyau24q-uc.a.run.app/mcp",
    )
    reg = McpStreamableHttpToolRegistry(
        url=url,
        server_id="meridian_orders",
        timeout_seconds=120.0,
    )
    await reg.initialize()
    tools = await reg.list_tools_flat()
    assert isinstance(tools, list)
    for t in tools:
        assert t.get("server_id") == "meridian_orders"
        assert "name" in t
