"""Meridian Support chat: threads, messages, and assistant replies (ReAct + optional MCP)."""

import logging
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import AliasChoices, BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.react_graph import create_react_graph, initial_react_state
from app.api.deps import get_current_user, get_db
from app.core.openrouter import OpenRouterClient
from app.db.models.chat import ChatConversation
from app.db.repositories.chat_repository import ChatRepository
from app.tools.registry import ToolRegistry
from app.utils.logger import log_exception
from app.utils.validators import parse_uuid

logger = logging.getLogger(__name__)

router = APIRouter()

_MAX_MESSAGE_CHARS = 32_000


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=_MAX_MESSAGE_CHARS)
    conversation_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("conversation_id", "session_id"),
    )

    @field_validator("message", mode="before")
    @classmethod
    def strip_message(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v

    @field_validator("conversation_id", mode="before")
    @classmethod
    def empty_conversation_id_to_none(cls, v: object) -> object:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s or None
        return v


class ChatResponse(BaseModel):
    conversation_id: str
    response: str
    scratchpad: list[dict[str, Any]] | None = None


class ChatMessageItem(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str


class ConversationMessagesResponse(BaseModel):
    conversation_id: str
    messages: list[ChatMessageItem]


class ConversationSummary(BaseModel):
    id: str
    title: str | None
    updated_at: datetime | None


class ConversationListResponse(BaseModel):
    conversations: list[ConversationSummary]


class ConversationCreatedResponse(BaseModel):
    conversation_id: str
    title: str | None = None


def _get_openrouter(request: Request) -> OpenRouterClient:
    client = getattr(request.app.state, "openrouter", None)
    if not client:
        raise HTTPException(status_code=503, detail="OpenRouter client not initialized")
    return client


def _get_registry(request: Request) -> ToolRegistry:
    reg = getattr(request.app.state, "tool_registry", None)
    if not reg:
        raise HTTPException(status_code=503, detail="Tool registry not initialized")
    return reg


@router.post("/conversations", response_model=ConversationCreatedResponse)
async def create_conversation(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationCreatedResponse:
    """Start a new empty conversation (no messages yet)."""
    user_id = user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=403, detail="User ID not found")
    row = await ChatRepository.create_conversation(db, user_id)
    await db.commit()
    return ConversationCreatedResponse(conversation_id=row.id, title=row.title)


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationListResponse:
    user_id = user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=403, detail="User ID not found")
    rows = await ChatRepository.list_conversations_for_user(db, user_id)
    return ConversationListResponse(
        conversations=[ConversationSummary(id=r.id, title=r.title, updated_at=r.updated_at) for r in rows]
    )


@router.get("/conversations/{conversation_id}/messages", response_model=ConversationMessagesResponse)
async def get_conversation_messages(
    conversation_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationMessagesResponse:
    user_id = user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=403, detail="User ID not found")
    parse_uuid(conversation_id, "conversation_id")
    conv = await ChatRepository.get_conversation_for_user(db, conversation_id, user_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    rows = await ChatRepository.list_messages_ordered(db, conv.id)
    items: list[ChatMessageItem] = []
    for r in rows:
        if r.role not in ("user", "assistant"):
            continue
        items.append(ChatMessageItem(id=r.id, role=r.role, content=r.content))
    return ConversationMessagesResponse(conversation_id=conv.id, messages=items)


@router.post("/", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    request: Request,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    user_id = user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=403, detail="User ID not found")

    conv: ChatConversation | None = None
    if body.conversation_id is None:
        conv = await ChatRepository.create_conversation(db, user_id)
    else:
        parse_uuid(body.conversation_id, "conversation_id")
        conv = await ChatRepository.get_conversation_for_user(db, body.conversation_id, user_id)
        if conv is None:
            raise HTTPException(status_code=404, detail="Conversation not found")

    existing = await ChatRepository.list_messages_ordered(db, conv.id)
    history = ChatRepository.messages_to_graph_history(existing)

    openrouter = _get_openrouter(request)
    registry = _get_registry(request)
    graph = create_react_graph(openrouter, registry)

    state = initial_react_state(
        user_id=user_id,
        conversation_id=conv.id,
        user_input=body.message,
        chat_history=history,
    )

    try:
        final = await graph.ainvoke(state)
    except Exception as exc:
        log_exception(
            logger,
            exc,
            context="ReAct graph ainvoke failed",
            extra_data={"user_id": user_id, "path": request.url.path},
        )
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    text = final.get("final_answer") or "No response generated."
    scratch = final.get("scratchpad")

    try:
        start_seq = await ChatRepository.max_sequence(db, conv.id) + 1
        await ChatRepository.append_user_assistant(db, conv.id, body.message, text, start_sequence=start_seq)
        if not existing:
            await ChatRepository.set_conversation_title_if_empty(db, conv.id, body.message)
        await ChatRepository.touch_conversation(db, conv.id)
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return ChatResponse(
        conversation_id=conv.id,
        response=text,
        scratchpad=scratch if isinstance(scratch, list) else None,
    )
