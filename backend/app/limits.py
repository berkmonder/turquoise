"""Limits for the public: how often one visitor may ask, and how much GPU time everyone together gets
in a day. In memory: turquoise runs as one process."""

import time
from collections import defaultdict, deque
from datetime import UTC, datetime

from fastapi import Request


def visitor(request: Request) -> str:
    """The visitor's address: Caddy in front puts it in X-Forwarded-For (nothing else reaches the app)."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimit:
    """At most `count` events per `window` seconds for each key (a sliding window)."""

    def __init__(self, count: int, window: float) -> None:
        self.count, self.window = count, window
        self._seen: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        seen = self._seen[key]
        while seen and seen[0] <= now - self.window:
            seen.popleft()
        if len(seen) >= self.count:
            return False
        seen.append(now)
        if len(self._seen) > 50_000:  # forget visitors who left
            for k in [k for k, v in self._seen.items() if not v]:
                del self._seen[k]
        return True

    def retry_after(self, key: str) -> int:
        seen = self._seen.get(key)
        if not seen:
            return 0
        return max(1, int(seen[0] + self.window - time.monotonic()) + 1)


class DailyBudget:
    """How many times something may happen per day (UTC), for everyone together."""

    def __init__(self, per_day: int) -> None:
        self.per_day = per_day
        self._day = ""
        self.used = 0

    def take(self) -> bool:
        today = datetime.now(UTC).date().isoformat()
        if today != self._day:
            self._day, self.used = today, 0
        if self.used >= self.per_day:
            return False
        self.used += 1
        return True
