"""The chat: POST /api/chat streams the answer (server-sent events); /api/v1/chat is the same, as one
JSON reply, for anyone's code."""

import asyncio
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .. import db
from ..config import settings
from ..events import Trace, sse
from ..limits import visitor
from ..state import state
from . import service

router = APIRouter()


class Ask(BaseModel):
    message: str = Field(min_length=1, max_length=settings.message_max_chars)
    conversation_id: str | None = Field(default=None, max_length=64)


class Turn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=4000)


class ApiAsk(BaseModel):
    message: str = Field(min_length=1, max_length=settings.message_max_chars)
    history: list[Turn] = Field(default_factory=list, max_length=settings.history_max_messages)


class ApiAnswer(BaseModel):
    answer: str
    served_by: str  # "gpu" (the model on Berk's PC) or "fallback" (CV search on the server)
    reason: str | None  # why the fallback answered


def too_many(limit_retry: int) -> HTTPException:
    return HTTPException(429, "Too many messages: try again in a few minutes.",
                         headers={"Retry-After": str(limit_retry)})


@router.post("/api/chat")
async def chat(ask: Ask, request: Request) -> StreamingResponse:
    who = visitor(request)
    if not state.chat_limit.allow(who):
        raise too_many(state.chat_limit.retry_after(who))
    conversation = await asyncio.to_thread(db.start_conversation, ask.conversation_id)
    await asyncio.to_thread(db.add_message, conversation, "user", ask.message.strip())
    history = await asyncio.to_thread(db.history, conversation, settings.history_max_messages)

    async def events() -> AsyncIterator[str]:
        yield sse({"type": "conversation", "id": conversation})
        parts: list[str] = []
        served_by = reason = None
        try:
            async for event in service.answer(history, Trace("chat")):
                if event["type"] == "token":
                    parts.append(event["text"])
                elif event["type"] == "done":
                    served_by, reason = event["served_by"], event.get("reason")
                yield sse(event)
        finally:  # also when the visitor leaves mid-answer: keep what was said
            if parts:
                await asyncio.to_thread(db.add_message, conversation, "assistant", "".join(parts),
                                        served_by, reason)

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/api/v1/chat", tags=["API"], summary="Ask about Berk (one JSON answer)")
async def api_chat(ask: ApiAsk, request: Request) -> ApiAnswer:
    """Ask the same agent as the site's chat. Nothing is stored. Up to 20 requests a minute."""
    who = visitor(request)
    if not state.api_limit.allow(who):
        raise too_many(state.api_limit.retry_after(who))
    history = [t.model_dump() for t in ask.history] + [{"role": "user", "content": ask.message}]
    parts: list[str] = []
    served_by, reason = "fallback", None
    async for event in service.answer(history, Trace("api")):
        if event["type"] == "token":
            parts.append(event["text"])
        elif event["type"] == "done":
            served_by, reason = event["served_by"], event.get("reason")
    return ApiAnswer(answer="".join(parts), served_by=served_by, reason=reason)
