from __future__ import annotations

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.chat import ChatConversation, ChatMessage


class ChatRepository:
    @staticmethod
    async def create_conversation(db: AsyncSession, user_id: str, title: str | None = None) -> ChatConversation:
        row = ChatConversation(id=str(uuid.uuid4()), user_id=str(user_id), title=title)
        db.add(row)
        await db.flush()
        await db.refresh(row)
        return row

    @staticmethod
    async def get_conversation_for_user(
        db: AsyncSession, conversation_id: str, user_id: str
    ) -> ChatConversation | None:
        r = await db.execute(
            select(ChatConversation).where(
                ChatConversation.id == str(conversation_id),
                ChatConversation.user_id == str(user_id),
            )
        )
        return r.scalars().first()

    @staticmethod
    async def list_conversations_for_user(db: AsyncSession, user_id: str, *, limit: int = 50) -> list[ChatConversation]:
        r = await db.execute(
            select(ChatConversation)
            .where(ChatConversation.user_id == str(user_id))
            .order_by(ChatConversation.updated_at.desc(), ChatConversation.created_at.desc())
            .limit(limit)
        )
        return list(r.scalars().all())

    @staticmethod
    async def max_sequence(db: AsyncSession, conversation_id: str) -> int:
        r = await db.execute(
            select(func.coalesce(func.max(ChatMessage.sequence), 0)).where(
                ChatMessage.conversation_id == str(conversation_id)
            )
        )
        return int(r.scalar_one())

    @staticmethod
    async def list_messages_ordered(db: AsyncSession, conversation_id: str) -> list[ChatMessage]:
        r = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == str(conversation_id))
            .order_by(ChatMessage.sequence.asc(), ChatMessage.created_at.asc())
        )
        return list(r.scalars().all())

    @staticmethod
    def messages_to_graph_history(rows: list[ChatMessage]) -> list[dict[str, str]]:
        out: list[dict[str, str]] = []
        for m in rows[-50:]:
            if m.role not in ("user", "assistant"):
                continue
            text = (m.content or "").strip()
            if not text:
                continue
            out.append({"role": m.role, "content": text})
        return out

    @staticmethod
    async def append_user_assistant(
        db: AsyncSession,
        conversation_id: str,
        user_text: str,
        assistant_text: str,
        *,
        start_sequence: int,
    ) -> tuple[ChatMessage, ChatMessage]:
        cid = str(conversation_id)
        u = ChatMessage(
            id=str(uuid.uuid4()),
            conversation_id=cid,
            role="user",
            content=user_text.strip(),
            sequence=start_sequence,
        )
        a = ChatMessage(
            id=str(uuid.uuid4()),
            conversation_id=cid,
            role="assistant",
            content=assistant_text.strip(),
            sequence=start_sequence + 1,
        )
        db.add_all([u, a])
        await db.flush()
        return u, a

    @staticmethod
    async def set_conversation_title_if_empty(db: AsyncSession, conversation_id: str, title: str) -> None:
        t = (title or "").strip()[:255] or None
        if not t:
            return
        await db.execute(
            update(ChatConversation)
            .where(ChatConversation.id == str(conversation_id), ChatConversation.title.is_(None))
            .values(title=t)
        )

    @staticmethod
    async def touch_conversation(db: AsyncSession, conversation_id: str) -> None:
        await db.execute(
            update(ChatConversation)
            .where(ChatConversation.id == str(conversation_id))
            .values(updated_at=func.now())
        )
