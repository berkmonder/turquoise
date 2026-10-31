"""One answer, through the pipeline: router → (queue → GPU) or fallback. Every step is an event: the
caller streams them to the visitor, the hub shows them to everyone watching the pipeline."""

import asyncio
import time
from collections.abc import AsyncIterator
from typing import Any

import httpx

from ..config import settings
from ..events import Trace
from ..state import state
from . import llm, prompt, search
from .queue import QueueFull


def done(trace: Trace, served_by: str, reason: str | None = None, **info: Any) -> dict[str, Any]:
    state.stats.count(served_by)
    return {**trace.stage("done", status="done", served_by=served_by, reason=reason, **info),
            "type": "done"}


async def answer(history: list[dict[str, str]], trace: Trace) -> AsyncIterator[dict[str, Any]]:
    """`history` ends with the question. Yields stage events, then `token`s, then `done`."""
    state.stats.count("chats")
    question = history[-1]["content"]
    yield trace.stage("received", status="done")

    if not state.llm.configured:
        reason: str | None = "not_configured"
    elif not state.llm.available:
        reason = "gpu_offline"
    elif not state.gpu_budget.take():
        reason = "daily_limit"
    else:
        reason = None

    if reason is None:
        yield trace.stage("router", status="done", decision="gpu")
        holding = False
        try:
            async for place in state.queue.turn(settings.queue_wait_s):
                yield trace.stage("queue", position=place, waiting=state.queue.waiting)
            holding = True
        except (QueueFull, TimeoutError):
            reason = "busy"
        if holding:
            parts: list[str] = []
            try:
                yield trace.stage("queue", status="done")
                yield trace.stage("gpu", active=state.queue.active, slots=state.queue.slots)
                started = time.perf_counter()
                first_token_ms = None
                async for text in llm.stream(state.client, state.llm, settings.gateway_model,
                                             prompt.messages(state.profile, history)):
                    if first_token_ms is None:
                        first_token_ms = round((time.perf_counter() - started) * 1000)
                        yield trace.stage("gpu", status="streaming", first_token_ms=first_token_ms)
                    parts.append(text)
                    yield {"type": "token", "text": text}
                state.llm.succeeded()
                seconds = max(time.perf_counter() - started, 1e-3)
                yield trace.stage("gpu", status="done", chunks=len(parts),
                                  chunks_per_s=round(len(parts) / seconds, 1))
                yield done(trace, "gpu", first_token_ms=first_token_ms)
                return
            except (httpx.HTTPError, llm.GatewayError):
                state.llm.failed()
                if parts:  # half an answer already went out: say so instead of starting over
                    yield {"type": "token", "text": "\n\n*(The answer was cut off: the GPU stopped "
                                                     "answering.)*"}
                    yield done(trace, "gpu", reason="cut_off")
                    return
                reason = "gpu_error"
            finally:
                state.queue.release()

    yield trace.stage("router", status="done", decision="fallback", reason=reason)
    assert state.search is not None
    yield trace.stage("fallback", semantic=state.search.semantic)
    results, timings = await asyncio.to_thread(state.search.search, question)
    yield trace.stage("fallback", status="done", found=len(results),
                      **{f"{k}_ms": round(v, 1) for k, v in timings.items()})
    yield {"type": "token", "text": search.answer(results, reason or "gpu_offline")}
    yield done(trace, "fallback", reason=reason)
