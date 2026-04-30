from __future__ import annotations

from typing import Any, NotRequired, TypedDict


class ScratchpadEntry(TypedDict):
    role: str
    content: str
    meta: NotRequired[dict[str, Any]]


class ReactState(TypedDict, total=False):
    user_id: str
    conversation_id: str
    user_input: str
    chat_history: list[dict[str, str]]
    scratchpad: list[ScratchpadEntry]
    pending_tool_call: dict[str, Any] | None
    final_answer: str | None
    error: str | None
    iteration: int
    max_iterations: int
    _last_raw_tool_result: NotRequired[Any]
