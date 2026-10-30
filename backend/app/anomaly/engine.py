"""The live anomaly demo. A smooth signal that never repeats is generated, four points a second; every
second a model forecasts the next 16 seconds with a band of what's normal. Visitors add points anywhere
on the chart: each one is judged against the band the model had for that moment, and everyone watching
sees the verdict. Only visitors' points are judged, never the generated signal."""

import asyncio
import itertools
import math
import random
import time
from collections import deque
from dataclasses import dataclass
from typing import Any

import httpx
import numpy as np

from ..events import Hub, Trace
from ..gpu import GpuService
from ..state import state
from .forecast import Forecast, autoregressive, chronos

DT = 0.25  # seconds between points
HORIZON = 64  # forecast steps: 16 seconds ahead
CONTEXT = 256  # points the model sees: the last 64 seconds
VISIBLE = 60.0  # seconds of history on the chart
THRESHOLD = 3.0  # a point further than this many sigmas from the expected value is an anomaly
MIN_SIGMA = 0.07  # the band never gets narrower than this: a click is never pixel-perfect

GOLDEN = (1 + 5**0.5) / 2


class Signal:
    """Sines whose periods relate by the golden ratio (so it never repeats), plus slow smooth noise."""

    def __init__(self, seed: int | None = None) -> None:
        self._rng = random.Random(seed)
        self._noise = 0.0

    def value(self, t: float) -> float:
        base = 14.0
        smooth = (math.sin(2 * math.pi * t / base)
                  + 0.55 * math.sin(2 * math.pi * t / (base * GOLDEN) + 0.7)
                  + 0.30 * math.sin(2 * math.pi * t / (base * GOLDEN**2) + 2.1))
        # Ornstein-Uhlenbeck: wanders, but smoothly and back toward zero.
        self._noise += -0.35 * self._noise * DT + 0.06 * math.sqrt(DT) * self._rng.gauss(0, 1)
        return smooth + self._noise


@dataclass
class Band:
    expected: float
    sigma: float
    source: str


class AnomalyDemo:
    def __init__(self, forecaster: GpuService, client: httpx.AsyncClient) -> None:
        self.forecaster, self.client = forecaster, client
        self.signal = Signal()
        self.points: deque[tuple[int, float]] = deque(maxlen=int(600 / DT))  # (step, value)
        self.bands: dict[int, Band] = {}  # step → the latest forecast made before it
        self.detections: deque[dict[str, Any]] = deque(maxlen=100)
        self.feed = Hub()  # the chart's own stream (points, bands, verdicts): /api/anomaly/stream
        self._ids = itertools.count(1)
        self.step = int(time.time() / DT)

    # -- the stream --------------------------------------------------------------------------------
    async def run(self) -> None:
        for s in range(self.step - CONTEXT, self.step):  # a minute of history to start from
            self.points.append((s, self.signal.value(s * DT)))
        await self.forecast()
        await asyncio.gather(self._tick(), self._forecast_every_second())

    async def _tick(self) -> None:
        while True:
            await asyncio.sleep(max(0.0, (self.step + 1) * DT - time.time()))
            self.step += 1
            value = self.signal.value(self.step * DT)
            self.points.append((self.step, value))
            self.feed.publish({"type": "point", "t": self.step * DT, "y": round(value, 4)})

    async def _forecast_every_second(self) -> None:
        while True:
            await asyncio.sleep(1.0)
            await self.forecast()

    async def forecast(self) -> None:
        trace = Trace("anomaly")
        context = np.array([v for _, v in list(self.points)[-CONTEXT:]])
        result: Forecast | None = None
        if self.forecaster.available:
            try:
                result = (await chronos(self.client, self.forecaster, [context], HORIZON))[0]
                self.forecaster.succeeded()
            except (httpx.HTTPError, KeyError, ValueError):
                self.forecaster.failed()
        if result is None:
            result = await asyncio.to_thread(autoregressive, context, HORIZON)
        first = self.step + 1
        sigma = np.maximum(result.sigma, MIN_SIGMA)
        for h in range(HORIZON):
            self.bands[first + h] = Band(float(result.median[h]), float(sigma[h]), result.source)
        oldest = self.step - int(VISIBLE / DT) - 8
        for s in [s for s in self.bands if s < oldest]:
            del self.bands[s]
        trace.stage("forecast", status="done", source=result.source)
        self.feed.publish({"type": "forecast", "t0": first * DT, "dt": DT,
                     "expected": [round(float(x), 4) for x in result.median],
                     "sigma": [round(float(x), 4) for x in sigma], "source": result.source,
                     "threshold": THRESHOLD})

    # -- visitors' points --------------------------------------------------------------------------
    def judge(self, t: float, y: float) -> dict[str, Any]:
        """Score a visitor's point against the band for its moment. Raises ValueError off the chart."""
        step = round(t / DT)
        band = self.bands.get(step)
        if band is None or step < self.step - int(VISIBLE / DT):
            raise ValueError("That moment isn't on the chart.")
        trace = Trace("anomaly")
        trace.stage("detect")
        z = (y - band.expected) / band.sigma
        detection = {"type": "detection", "id": next(self._ids),
                     "t": step * DT, "y": y, "expected": round(band.expected, 4),
                     "sigma": round(band.sigma, 4), "z": round(z, 2),
                     "label": "anomaly" if abs(z) > THRESHOLD else "normal", "source": band.source}
        self.detections.append(detection)
        state.stats.count("detections")
        trace.stage("detect", status="done", label=detection["label"], source=band.source)
        self.feed.publish(dict(detection))
        return detection

    def snapshot(self) -> dict[str, Any]:
        """Everything a new viewer needs to draw the chart before the live events take over."""
        since = self.step - int(VISIBLE / DT)
        steps = sorted(s for s in self.bands if s >= since)
        return {
            "type": "snapshot", "dt": DT, "now": self.step * DT, "visible": VISIBLE,
            "horizon": HORIZON * DT, "threshold": THRESHOLD,
            "points": [[s * DT, round(v, 4)] for s, v in self.points if s >= since],
            "bands": [[s * DT, round(self.bands[s].expected, 4), round(self.bands[s].sigma, 4),
                       self.bands[s].source] for s in steps],
            "detections": [d for d in self.detections if d["t"] >= since * DT],
        }


def detect_series(values: list[float], threshold: float, forecasts: list[Forecast],
                  starts: list[int], horizon: int) -> list[dict[str, Any]]:
    """For the API, with forecasts made beforehand (the GPU, one batch): judge each point against the
    forecast made just before it."""
    spread = float(np.std(values)) or 1.0
    found = []
    for start, f in zip(starts, forecasts, strict=True):
        for h in range(min(horizon, len(values) - start)):
            i = start + h
            sigma = max(float(f.sigma[h]), 0.05 * spread)
            z = (values[i] - float(f.median[h])) / sigma
            if abs(z) > threshold:
                found.append({"index": i, "value": values[i], "expected": round(float(f.median[h]), 4),
                              "z": round(z, 2)})
    return found


def detect_sequential(values: list[float], threshold: float, first: int, horizon: int,
                      context: int) -> list[dict[str, Any]]:
    """For the API, on the CPU: forecast, judge, move on. An anomaly is clipped to the band's edge in
    the history the next forecasts learn from, so one spike doesn't make its neighbours look odd too."""
    seen = np.asarray(values, dtype=float).copy()
    spread = float(np.std(seen)) or 1.0
    found = []
    for start in range(first, len(seen), horizon):
        f = autoregressive(seen[max(0, start - context):start], horizon)
        for h in range(min(horizon, len(seen) - start)):
            i = start + h
            sigma = max(float(f.sigma[h]), 0.05 * spread)
            z = (values[i] - float(f.median[h])) / sigma
            if abs(z) > threshold:
                found.append({"index": i, "value": values[i], "expected": round(float(f.median[h]), 4),
                              "z": round(z, 2)})
                seen[i] = float(f.median[h]) + np.sign(z) * threshold * sigma
    return found
