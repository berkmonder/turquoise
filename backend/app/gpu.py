"""Is Berk's PC there? Each GPU service on it (the LLM gateway, the forecaster) is checked every few
seconds over Tailscale. A service that doesn't answer (the PC is off or asleep, Alperen is stopped for a
game) or whose requests keep failing is "offline": requests go to the fallback at once, without waiting
for a timeout, until it answers again."""

import asyncio
import time

import httpx

from .events import hub


class GpuService:
    def __init__(self, name: str, url: str, health_path: str, key: str = "") -> None:
        self.name, self.url, self.health_path = name, url.rstrip("/"), health_path
        self.headers = {"Authorization": f"Bearer {key}"} if key else {}
        self.reachable = False
        self.failures = 0  # consecutive failed requests
        self.paused_until = 0.0  # after repeated failures: don't try for a while
        self.last_change = time.time()

    @property
    def configured(self) -> bool:
        return bool(self.url)

    @property
    def available(self) -> bool:
        return self.configured and self.reachable and time.monotonic() >= self.paused_until

    def succeeded(self) -> None:
        self.failures = 0

    def failed(self) -> None:
        """A request failed: after two in a row, stop trying for 30 seconds."""
        self.failures += 1
        if self.failures >= 2:
            self.paused_until = time.monotonic() + 30
            self._announce()

    async def check(self, client: httpx.AsyncClient) -> None:
        try:
            response = await client.get(self.url + self.health_path, headers=self.headers, timeout=2.5)
            reachable = response.status_code == 200
        except httpx.HTTPError:
            reachable = False
        if reachable != self.reachable:
            self.reachable = reachable
            self.last_change = time.time()
            if reachable:
                self.failures, self.paused_until = 0, 0.0
            self._announce()

    def _announce(self) -> None:
        hub.publish({"type": "gpu", "service": self.name, "available": self.available})

    def state(self) -> dict[str, object]:
        return {"configured": self.configured, "available": self.available, "since": self.last_change}


async def watch(services: list[GpuService], every: float = 5.0) -> None:
    async with httpx.AsyncClient() as client:
        while True:
            await asyncio.gather(*(s.check(client) for s in services if s.configured))
            await asyncio.sleep(every)
