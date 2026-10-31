"""What the pipeline panel shows: /api/live streams every request's stages as they happen (for all
visitors), with a status snapshot every few seconds; /api/status is the snapshot alone."""

import asyncio
import time
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from .events import hub, sse
from .state import state

router = APIRouter()


def status() -> dict[str, Any]:
    s = state.stats
    return {
        "type": "status",
        "ts": time.time(),
        "gpu": {"llm": state.llm.state(), "forecaster": state.forecaster.state()},
        "queue": {"active": state.queue.active, "waiting": state.queue.waiting,
                  "slots": state.queue.slots},
        "today": {"chats": s.chats, "gpu": s.gpu, "fallback": s.fallback,
                  "detections": s.detections},
        "search": {"semantic": bool(state.search and state.search.semantic)},
        "watchers": hub.watchers,
    }


@router.get("/api/status")
async def get_status() -> dict[str, Any]:
    return status()


@router.get("/api/live")
async def live() -> StreamingResponse:
    async def events() -> AsyncIterator[str]:
        yield sse(status())
        feed = hub.subscribe()
        nxt = asyncio.ensure_future(anext(feed))
        try:
            while True:
                finished, _ = await asyncio.wait({nxt}, timeout=3.0)
                if finished:
                    yield sse(nxt.result())
                    nxt = asyncio.ensure_future(anext(feed))
                else:
                    yield sse(status())
        finally:
            nxt.cancel()
            await feed.aclose()

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
