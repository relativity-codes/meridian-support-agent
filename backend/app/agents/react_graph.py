from __future__ import annotations

import logging
from typing import Any

from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage, AIMessage

from app.config import settings
from app.core.openrouter import OpenRouterClient
from app.core.prompts import REACT_SYSTEM_PROMPT
from app.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def create_react_graph(openrouter: OpenRouterClient, registry: ToolRegistry):
    """
    Creates a LangGraph ReAct agent using the prebuilt create_react_agent.
    """
    model = openrouter.get_chat_model()
    tools = registry.get_langchain_tools()

    system_message = SystemMessage(content=REACT_SYSTEM_PROMPT)

    agent = create_react_agent(
        model,
        tools=tools,
        prompt=system_message,
    )
    return agent


def initial_react_state(
    *,
    user_id: str,
    conversation_id: str,
    user_input: str,
    chat_history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    """
    Initial state for the new LangChain-based ReAct agent.
    create_react_agent expects a dictionary with a 'messages' key.
    """
    messages: list[BaseMessage] = []

    # Convert history to LangChain messages if needed
    if chat_history:
        for m in chat_history:
            role = m.get("role")
            content = m.get("content") or m.get("message") or ""
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                messages.append(AIMessage(content=content))

    # Add the current user input
    messages.append(HumanMessage(content=user_input))

    return {
        "messages": messages,
        # We can still keep our custom metadata if the state allows it,
        # but create_react_agent primarily looks at 'messages'.
        "user_id": user_id,
        "conversation_id": conversation_id,
    }
