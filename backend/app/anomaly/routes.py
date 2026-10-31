"""The anomaly demo's stream and points (/api/anomaly/...), and anomaly detection for anyone's series
(/api/v1/anomaly/detect)."""

import asyncio
from collections.abc import AsyncIterator
from typing import Any

import httpx
import numpy as np
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..events import Trace, sse
from ..limits import visitor
from ..state import state
from .engine import AnomalyDemo, detect_sequential, detect_series
from .forecast import chronos

router = APIRouter()
demo: AnomalyDemo | None = None  # made at startup (main.lifespan)


class Point(BaseModel):
    t: float  # seconds (Unix time), within the chart
    y: float = Field(ge=-100, le=100)


@router.get("/api/anomaly/stream")
async def stream() -> StreamingResponse:
    if demo is None:
        raise HTTPException(503, "The demo is starting.")
    live = demo

    async def events() -> AsyncIterator[str]:
        yield sse(live.snapshot())
        async for event in live.feed.subscribe():
            yield sse(event)

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/api/anomaly/points")
async def add_point(point: Point, request: Request) -> dict[str, Any]:
    if demo is None:
        raise HTTPException(503, "The demo is starting.")
    who = visitor(request)
    if not state.point_limit.allow(who):
        raise HTTPException(429, "That's a lot of points: wait a minute.",
                            headers={"Retry-After": str(state.point_limit.retry_after(who))})
    try:
        return demo.add(point.t, point.y)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


class Series(BaseModel):
    values: list[float] = Field(min_length=80, max_length=5000)
    threshold: float = Field(default=3.5, gt=0, le=20)


class Anomaly(BaseModel):
    index: int
    value: float
    expected: float
    z: float  # how many standard deviations from what was expected


class Detected(BaseModel):
    anomalies: list[Anomaly]
    checked_from: int  # the first points only teach the model; checking starts here
    served_by: str  # "gpu" (Chronos-Bolt on Berk's PC) or "fallback" (autoregression on the server)


@router.post("/api/v1/anomaly/detect", tags=["API"], summary="Find anomalies in a series")
async def detect(series: Series, request: Request) -> Detected:
    """Send evenly spaced values; each point is compared with a forecast made from the points before
    it. Points further than `threshold` standard deviations from it are anomalies. Up to 20 requests
    a minute; nothing is stored."""
    who = visitor(request)
    if not state.api_limit.allow(who):
        raise HTTPException(429, "Too many requests: try again in a minute.")
    trace = Trace("api-anomaly")
    trace.stage("received", status="done")
    values = np.asarray(series.values, dtype=float)
    first, horizon, context = 64, 16, 256
    found = None
    served_by = "fallback"
    if state.forecaster.available:
        starts = list(range(first, len(values), horizon))
        windows = [values[max(0, s - context):s] for s in starts]
        try:
            forecasts = await chronos(state.client, state.forecaster, windows, horizon, timeout=10)
            state.forecaster.succeeded()
            found = detect_series(series.values, series.threshold, forecasts, starts, horizon)
            served_by = "gpu"
        except (httpx.HTTPError, KeyError, ValueError):
            state.forecaster.failed()
    if found is None:
        found = await asyncio.to_thread(detect_sequential, series.values, series.threshold, first,
                                        horizon, context)
    trace.stage("done", status="done", served_by=served_by, found=len(found))
    return Detected(anomalies=[Anomaly(**a) for a in found], checked_from=first, served_by=served_by)
