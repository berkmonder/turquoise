"""Turquoise's API. /api/chat runs the agent and streams every step of it in the Vercel AI SDK's
message-stream format (the chat in `frontend/` reads it with the SDK's `useChat`). /api/status says
whether Berk's GPU is on. One process: limits and the queue are in memory."""

import asyncio
import contextlib
import json
from collections.abc import AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
from pydantic_ai.usage import UsageLimits

from . import gpu, site, tracing
from .agent import Visit, agent, gpu_model, quick_model
from .config import settings
from .limits import visitor
from .queue import QueueFull
from .state import state


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    tasks = [asyncio.create_task(gpu.watch([state.llm]))]
    if settings.site_url:  # the CV and the pages (site.py)
        tasks.append(asyncio.create_task(site.keep_fresh()))
    if settings.mlflow_tracking_uri:  # traces in MLflow, once the PC answers (tracing.py)
        tasks.append(asyncio.create_task(tracing.keep_trying()))
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        await state.client.aclose()


app = FastAPI(title="Turquoise", version="3.0.0", lifespan=lifespan,
              docs_url="/api/docs", redoc_url=None, openapi_url="/api/openapi.json")


def page_of(request: Request) -> str | None:
    """The page the visitor is on, as the chat says it (X-Turquoise-Page: its path, e.g. /learn/llm/)."""
    page = request.headers.get("x-turquoise-page", "").split("?")[0].split("#")[0]
    return page if page.startswith("/") and not page.startswith("//") and len(page) <= 300 else None


def check(body: dict) -> None:
    """A conversation the size of a chat, not a document: so many messages, the last one so long."""
    messages = body.get("messages") or []
    if not messages or len(messages) > settings.history_max_messages:
        raise HTTPException(422, "Start a new conversation: this one is too long.")
    text = "".join(p.get("text", "") for p in messages[-1].get("parts", []) if p.get("type") == "text")
    if not text.strip() or len(text) > settings.message_max_chars:
        raise HTTPException(422, f"Ask in at most {settings.message_max_chars} characters.")


async def gpu_turn() -> str | None:
    """Take a place on the GPU, or say why not (then it's a quick answer)."""
    if not state.llm.configured:
        return "not_configured"
    if not state.llm.available:
        return "gpu_offline"
    if not state.gpu_budget.take():
        return "daily_limit"
    try:
        async for _ in state.queue.turn(settings.queue_wait_s):
            pass
    except (QueueFull, TimeoutError):
        return "busy"
    return None


@app.post("/api/chat")
async def chat(request: Request) -> Response:
    who = visitor(request)
    if not state.chat_limit.allow(who):
        raise HTTPException(429, "Too many messages: try again in a few minutes.",
                            headers={"Retry-After": str(state.chat_limit.retry_after(who))})
    try:
        body = json.loads(await request.body())
        check(body)
    except (ValueError, AttributeError) as error:
        raise HTTPException(422, "Not a chat request.") from error

    chat_id = body.get("id") if isinstance(body.get("id"), str) and len(body["id"]) <= 100 else None
    page = page_of(request)
    reason = await gpu_turn()
    model = gpu_model(page) if reason is None else quick_model(reason, page)
    try:
        response = await VercelAIAdapter.dispatch_request(
            request, agent=agent, model=model, deps=Visit(page), sdk_version=7,
            usage_limits=UsageLimits(request_limit=settings.agent_max_requests))
    except BaseException:
        if reason is None:
            state.queue.release()
        raise
    if isinstance(response, StreamingResponse):
        inner = response.body_iterator

        async def streamed() -> AsyncIterator[str | bytes | memoryview]:
            try:
                with tracing.answer(chat_id, page, reason or "gpu"):  # the agent runs as it streams
                    async for chunk in inner:
                        yield chunk
            finally:  # also when the visitor leaves mid-answer
                if reason is None:
                    state.queue.release()

        response.body_iterator = streamed()
    elif reason is None:
        state.queue.release()
    return response


@app.get("/api/status")
async def status() -> dict[str, object]:
    return {
        "gpu": {"llm": state.llm.state()},
        "queue": {"active": state.queue.active, "waiting": state.queue.waiting, "slots": state.queue.slots},
        "sources": {"profile": len(state.profile.sections) if state.profile else 0,
                    "site": len(state.site.sections) if state.site else 0},
    }


@app.get("/api/health", include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok"}
