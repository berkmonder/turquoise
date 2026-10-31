"""Turquoise's API: the chat with Berk's agent, the live anomaly demo, the pipeline feed, and the public
API (/api/v1, documented at /api/docs). One process: limits, the queue and the live feed are in memory."""

import asyncio
import contextlib
import logging
import re
from collections.abc import AsyncIterator

from fastapi import FastAPI

from . import contact, db, gpu, live
from .anomaly import routes as anomaly
from .anomaly.engine import AnomalyDemo
from .chat import routes as chat
from .chat.search import ProfileSearch
from .config import settings
from .state import state

log = logging.getLogger("turquoise")


async def forget_every_day() -> None:
    while True:
        deleted = await asyncio.to_thread(db.forget_old, settings.retention_days)
        if deleted:
            log.info("retention: deleted %d rows older than %d days", deleted, settings.retention_days)
        await asyncio.sleep(24 * 3600)


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    for attempt in range(1, 11):  # Postgres may still be starting
        try:
            await asyncio.to_thread(db.init_db)
            break
        except Exception as error:  # noqa: BLE001
            if attempt == 10:
                raise
            log.warning("database not ready (%s), retrying", error)
            await asyncio.sleep(2 * attempt)
    # Without HTML comments: the file's own notes aren't part of the profile.
    state.profile = re.sub(r"<!--.*?-->", "", settings.profile_path.read_text(encoding="utf-8"),
                           flags=re.S)
    state.search = ProfileSearch(state.profile, settings.embedding_model or None)
    anomaly.demo = AnomalyDemo(state.forecaster, state.client)
    tasks = [
        asyncio.create_task(gpu.watch([state.llm, state.forecaster])),
        asyncio.create_task(anomaly.demo.run()),
        asyncio.create_task(forget_every_day()),
    ]
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        await state.client.aclose()


app = FastAPI(
    title="Turquoise API",
    version="2.0.0",
    description="Ask about Berk, and find anomalies in a series. Heavy work runs on Berk's GPU "
    "when it's available; otherwise a lighter fallback answers, and every reply says which.",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)
for module in (chat, anomaly, contact, live):
    app.include_router(module.router)


@app.get("/api/health", include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok"}
