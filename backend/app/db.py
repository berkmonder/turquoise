"""What turquoise keeps: conversations with the agent and contact requests, for 90 days."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlmodel import Field, Session, SQLModel, col, create_engine, delete, select

from .config import settings


def now() -> datetime:
    return datetime.now(UTC)


class Conversation(SQLModel, table=True):
    __tablename__ = "conversations"
    id: str = Field(default_factory=lambda: uuid.uuid4().hex, primary_key=True)
    created_at: datetime = Field(default_factory=now, index=True)


class Message(SQLModel, table=True):
    __tablename__ = "messages"
    id: int | None = Field(default=None, primary_key=True)
    conversation_id: str = Field(foreign_key="conversations.id", index=True)
    role: str  # "user" or "assistant"
    content: str
    served_by: str | None = None  # "gpu" or "fallback"
    reason: str | None = None  # why the fallback answered
    created_at: datetime = Field(default_factory=now, index=True)


class Contact(SQLModel, table=True):
    __tablename__ = "contacts"
    id: int | None = Field(default=None, primary_key=True)
    conversation_id: str | None = None
    name: str
    email: str
    message: str
    created_at: datetime = Field(default_factory=now, index=True)


def _url(url: str) -> str:
    """Postgres through psycopg 3 (a plain postgresql:// URL would ask SQLAlchemy for psycopg2)."""
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    return url


_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(_url(settings.database_url), connect_args=_connect_args, pool_pre_ping=True)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def session() -> Session:
    return Session(engine)


def start_conversation(conversation_id: str | None) -> str:
    with session() as s:
        if conversation_id and s.get(Conversation, conversation_id):
            return conversation_id
        conversation = Conversation()
        s.add(conversation)
        s.commit()
        return conversation.id


def add_message(conversation_id: str, role: str, content: str, served_by: str | None = None,
                reason: str | None = None) -> None:
    with session() as s:
        s.add(Message(conversation_id=conversation_id, role=role, content=content,
                      served_by=served_by, reason=reason))
        s.commit()


def history(conversation_id: str, limit: int) -> list[dict[str, str]]:
    """The conversation's last messages, oldest first, as chat messages."""
    with session() as s:
        rows = s.exec(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(col(Message.id).desc())
            .limit(limit)
        ).all()
    return [{"role": m.role, "content": m.content} for m in reversed(rows)]


def forget_old(days: int) -> int:
    """Delete what's older than `days` (the notice on the chat promises 90). Returns rows deleted."""
    cutoff = now() - timedelta(days=days)
    with session() as s:
        old = select(Conversation.id).where(col(Conversation.created_at) < cutoff)
        deleted = 0
        for statement in (
            delete(Message).where(col(Message.conversation_id).in_(old)),
            delete(Contact).where(col(Contact.created_at) < cutoff),
            delete(Conversation).where(col(Conversation.created_at) < cutoff),
        ):
            deleted += s.exec(statement).rowcount  # type: ignore[call-overload]
        s.commit()
    return deleted
