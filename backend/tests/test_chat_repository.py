from __future__ import annotations

import uuid

from app.db.repositories.chat_repository import ChatRepository
from app.db.repositories.user_repository import UserRepository
from app.db.session import async_session_factory


async def test_chat_repository_conversation_and_messages() -> None:
    email = f"chat-{uuid.uuid4()}@example.com"
    async with async_session_factory() as session:
        user = await UserRepository.create(
            session,
            google_id=f"gid-{uuid.uuid4()}",
            email=email,
            name="Chat Tester",
        )
        await session.commit()

    uid = str(user.id)
    async with async_session_factory() as session:
        conv = await ChatRepository.create_conversation(session, uid)
        await session.commit()
        cid = conv.id

    async with async_session_factory() as session:
        conv2 = await ChatRepository.get_conversation_for_user(session, cid, uid)
        assert conv2 is not None
        assert await ChatRepository.max_sequence(session, cid) == 0
        await ChatRepository.append_user_assistant(session, cid, "Hello", "Hi there", start_sequence=1)
        await session.commit()

    async with async_session_factory() as session:
        rows = await ChatRepository.list_messages_ordered(session, cid)
        assert len(rows) == 2
        assert rows[0].role == "user" and rows[0].content == "Hello"
        assert rows[1].role == "assistant"
        hist = ChatRepository.messages_to_graph_history(rows)
        assert len(hist) == 2
        wrong = await ChatRepository.get_conversation_for_user(session, cid, "other-user-id")
        assert wrong is None
