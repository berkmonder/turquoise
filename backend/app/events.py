"""The live feed behind the pipeline panel: every stage a request passes through is an event, sent to
everyone watching (/api/live). Events carry no content, only which stage and how long it took."""

import asyncio
import json
import secrets
import time
from collections.abc import AsyncIterator
from typing import Any


class Hub:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()

    def publish(self, event: dict[str, Any]) -> None:
        event.setdefault("ts", time.time())
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:  # a slow viewer misses events rather than slowing everyone
                pass

    async def subscribe(self) -> AsyncIterator[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=200)
        self._subscribers.add(queue)
        try:
            while True:
                yield await queue.get()
        finally:
            self._subscribers.discard(queue)

    @property
    def watchers(self) -> int:
        return len(self._subscribers)


hub = Hub()


class Trace:
    """One request's way through the pipeline: `stage()` tells the panel (and the requester) where it is."""

    def __init__(self, kind: str) -> None:
        self.kind = kind
        self.id = secrets.token_hex(4)
        self.started = time.perf_counter()

    def stage(self, stage: str, status: str = "active", **info: Any) -> dict[str, Any]:
        event = {"type": "stage", "kind": self.kind, "rid": self.id, "stage": stage, "status": status,
                 "ms": round((time.perf_counter() - self.started) * 1000), **info}
        hub.publish(dict(event))
        return event


def sse(event: dict[str, Any], name: str | None = None) -> str:
    """One server-sent event."""
    head = f"event: {name}\n" if name else ""
    return f"{head}data: {json.dumps(event, separators=(',', ':'))}\n\n"
