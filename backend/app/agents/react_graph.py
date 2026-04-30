from __future__ import annotations

import json
import logging
import re
from typing import Any, Literal

from langgraph.graph import END, StateGraph

from app.agents.react_state import ReactState, ScratchpadEntry
from app.config import settings
from app.core.openrouter import OpenRouterClient
from app.core.prompts import REACT_SYSTEM_PROMPT
from app.tools.registry import ToolRegistry
from app.utils.logger import log_exception

logger = logging.getLogger(__name__)


def _parse_llm_json(content: str) -> dict[str, Any] | None:
    text = (content or "").strip()
    if not text:
        return None
    m = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if m:
        text = m.group(1).strip()
    else:
        om = re.search(r"(\{.*\})", text, re.DOTALL)
        if om:
            text = om.group(1)
    try:
        out = json.loads(text)
        return out if isinstance(out, dict) else None
    except json.JSONDecodeError:
        return None


def _format_scratchpad(scratchpad: list[ScratchpadEntry]) -> str:
    if not scratchpad:
        return "(empty)"
    lines: list[str] = []
    for e in scratchpad:
        role = e.get("role", "note")
        content = e.get("content", "")
        lines.append(f"[{role}]\n{content}")
    return "\n\n".join(lines)


def _format_chat_history(history: list[dict[str, str]]) -> str:
    if not history:
        return ""
    parts: list[str] = []
    for m in history[-40:]:
        role = m.get("role", "user")
        msg = m.get("message") or m.get("content") or ""
        parts.append(f"{role}: {msg}")
    return "\n".join(parts)


def create_react_graph(openrouter: OpenRouterClient, registry: ToolRegistry) -> StateGraph:
    async def think(state: ReactState) -> dict[str, Any]:
        iteration = int(state.get("iteration") or 0)
        max_it = int(state.get("max_iterations") or settings.MAX_REACT_ITERATIONS)
        scratchpad: list[ScratchpadEntry] = list(state.get("scratchpad") or [])

        if state.get("final_answer"):
            return {}

        if iteration >= max_it:
            return {
                "final_answer": state.get("final_answer")
                or "Stopped: reached maximum reasoning steps without a final answer.",
                "error": "max_iterations",
                "pending_tool_call": None,
            }

        tools = await registry.list_tools_flat()
        tools_json = json.dumps(tools, default=str)

        system = (REACT_SYSTEM_PROMPT or "").strip() + f"\n\n## Available tools (JSON)\n{tools_json}"
        goal = state.get("user_input", "")
        hist = _format_chat_history(state.get("chat_history") or [])
        pad = _format_scratchpad(scratchpad)

        user_block = f"## User goal\n{goal}\n\n## Prior chat\n{hist}\n\n## Scratchpad\n{pad}"

        try:
            response = await openrouter.complete(
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_block},
                ],
                temperature=0.2,
                max_tokens=8192,
            )
            raw = response["choices"][0]["message"]["content"]
        except Exception as exc:
            log_exception(logger, exc, context="ReAct think: OpenRouter complete failed")
            return {
                "final_answer": f"The model request failed: {exc}",
                "error": str(exc),
                "pending_tool_call": None,
            }

        parsed = _parse_llm_json(raw)
        if not parsed:
            return {
                "scratchpad": scratchpad
                + [{"role": "thought", "content": raw[:2000] if raw else "(empty model output)"}],
                "final_answer": "I could not parse the model output as JSON. Please try again.",
                "error": "parse_error",
                "pending_tool_call": None,
            }

        thought = str(parsed.get("thought") or "").strip()
        scratchpad = scratchpad + [{"role": "thought", "content": thought or "(no thought)"}]

        final_answer = parsed.get("final_answer")
        if final_answer is not None and str(final_answer).strip():
            return {
                "scratchpad": scratchpad,
                "final_answer": str(final_answer).strip(),
                "pending_tool_call": None,
            }

        action = parsed.get("action")
        if isinstance(action, dict) and action.get("tool") and action.get("server_id"):
            pending = {
                "server_id": str(action["server_id"]),
                "tool": str(action["tool"]),
                "arguments": action.get("arguments") if isinstance(action.get("arguments"), dict) else {},
            }
            return {
                "scratchpad": scratchpad,
                "pending_tool_call": pending,
            }

        return {
            "scratchpad": scratchpad,
            "final_answer": "Model returned neither a valid tool action nor a final answer.",
            "error": "invalid_action",
            "pending_tool_call": None,
        }

    async def act(state: ReactState) -> dict[str, Any]:
        pending = state.get("pending_tool_call")
        if not pending:
            return {}
        scratchpad = list(state.get("scratchpad") or [])
        scratchpad.append(
            {
                "role": "action",
                "content": json.dumps(pending, default=str),
            }
        )
        user_id = state.get("user_id")
        try:
            result = await registry.invoke_tool(
                pending["server_id"],
                pending["tool"],
                pending.get("arguments") or {},
                user_id=user_id,
            )
        except Exception as exc:
            log_exception(
                logger,
                exc,
                context="ReAct act: tool invocation failed",
                extra_data={
                    "server_id": pending.get("server_id"),
                    "tool": pending.get("tool"),
                    "user_id": user_id,
                },
            )
            result = {"error": "invoke_failed", "message": str(exc)}
        return {
            "scratchpad": scratchpad,
            "_last_raw_tool_result": result,
        }

    async def observe(state: ReactState) -> dict[str, Any]:
        raw = state.get("_last_raw_tool_result", None)
        iteration = int(state.get("iteration") or 0)
        scratchpad = list(state.get("scratchpad") or [])
        obs_text = json.dumps(raw, default=str) if raw is not None else "(no result)"
        scratchpad.append({"role": "observation", "content": obs_text})
        return {
            "scratchpad": scratchpad,
            "pending_tool_call": None,
            "iteration": iteration + 1,
            "_last_raw_tool_result": None,
        }

    def route_after_think(state: ReactState) -> Literal["act", "end"]:
        if state.get("final_answer"):
            return "end"
        if state.get("pending_tool_call"):
            return "act"
        return "end"

    def route_after_observe(state: ReactState) -> Literal["think"]:
        return "think"

    workflow = StateGraph(ReactState)
    workflow.add_node("think", think)
    workflow.add_node("act", act)
    workflow.add_node("observe", observe)

    workflow.set_entry_point("think")
    workflow.add_conditional_edges(
        "think",
        route_after_think,
        {"act": "act", "end": END},
    )
    workflow.add_edge("act", "observe")
    workflow.add_conditional_edges(
        "observe",
        route_after_observe,
        {"think": "think"},
    )

    return workflow.compile()


def initial_react_state(
    *,
    user_id: str,
    conversation_id: str,
    user_input: str,
    chat_history: list[dict[str, str]] | None = None,
) -> ReactState:
    return {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "user_input": user_input,
        "chat_history": chat_history or [],
        "scratchpad": [],
        "pending_tool_call": None,
        "final_answer": None,
        "error": None,
        "iteration": 0,
        "max_iterations": settings.MAX_REACT_ITERATIONS,
    }
