"""The running app's shared parts, made once at startup (main.lifespan)."""

from dataclasses import dataclass, field

import httpx

from .config import settings
from .gpu import GpuService
from .limits import DailyBudget, RateLimit
from .queue import SlotQueue
from .search import SearchIndex


@dataclass
class State:
    profile: SearchIndex | None = None  # Berk's CV
    site: SearchIndex | None = None  # the website's pages
    client: httpx.AsyncClient = field(default_factory=httpx.AsyncClient)
    llm: GpuService = field(default_factory=lambda: GpuService(
        "llm", settings.llm_url, "/health/readiness", settings.llm_key))
    queue: SlotQueue = field(default_factory=lambda: SlotQueue(settings.gpu_concurrency,
                                                               settings.queue_max))
    gpu_budget: DailyBudget = field(default_factory=lambda: DailyBudget(settings.gpu_chats_per_day))
    chat_limit: RateLimit = field(default_factory=lambda: RateLimit(settings.chat_per_visitor,
                                                                    settings.chat_window_s))


state = State()
