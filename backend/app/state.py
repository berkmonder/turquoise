"""The running app's shared parts, made once at startup (main.lifespan)."""

from dataclasses import dataclass, field
from datetime import UTC, datetime

import httpx

from .anomaly.forecast import Chronos
from .chat.queue import SlotQueue
from .chat.search import ProfileSearch
from .config import settings
from .gpu import GpuService
from .limits import DailyBudget, RateLimit


@dataclass
class Stats:
    """Today's numbers for the pipeline panel (since the last restart)."""

    day: str = ""
    chats: int = 0
    gpu: int = 0
    fallback: int = 0
    detections: int = 0

    def count(self, what: str) -> None:
        today = datetime.now(UTC).date().isoformat()
        if today != self.day:
            self.day, self.chats, self.gpu, self.fallback, self.detections = today, 0, 0, 0, 0
        setattr(self, what, getattr(self, what) + 1)


@dataclass
class State:
    profile: str = ""
    search: ProfileSearch | None = None
    client: httpx.AsyncClient = field(default_factory=httpx.AsyncClient)
    llm: GpuService = field(default_factory=lambda: GpuService(
        "llm", settings.alperen_url, "/health", settings.alperen_key))
    chronos: Chronos = field(default_factory=lambda: Chronos(settings.forecaster_model,
                                                             settings.forecaster_threads))
    queue: SlotQueue = field(default_factory=lambda: SlotQueue(settings.gpu_concurrency,
                                                               settings.queue_max))
    gpu_budget: DailyBudget = field(default_factory=lambda: DailyBudget(settings.gpu_chats_per_day))
    chat_limit: RateLimit = field(default_factory=lambda: RateLimit(settings.chat_per_visitor,
                                                                    settings.chat_window_s))
    api_limit: RateLimit = field(default_factory=lambda: RateLimit(20, 60))
    contact_limit: RateLimit = field(default_factory=lambda: RateLimit(3, 3600))
    point_limit: RateLimit = field(default_factory=lambda: RateLimit(30, 60))
    stats: Stats = field(default_factory=Stats)


state = State()
