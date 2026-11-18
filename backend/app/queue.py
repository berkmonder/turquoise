"""The line in front of the GPU. The engine answers a few conversations at once (they're decoded in one
batch); more people than that wait their turn, first come first served, and see where they are."""

import asyncio
import time
from collections import deque
from collections.abc import AsyncIterator


class QueueFull(Exception):
    pass


class SlotQueue:
    def __init__(self, slots: int, max_waiting: int) -> None:
        self.slots, self.max_waiting = slots, max_waiting
        self.active = 0
        self._waiting: deque[asyncio.Future[None]] = deque()

    @property
    def waiting(self) -> int:
        return len(self._waiting)

    async def turn(self, timeout: float) -> AsyncIterator[int]:
        """Wait for a slot, yielding the place in line (1 = next) while waiting. Returns holding a slot;
        raises QueueFull if the line is too long, TimeoutError if the turn doesn't come in time."""
        if self.active < self.slots and not self._waiting:
            self.active += 1
            return
        if len(self._waiting) >= self.max_waiting:
            raise QueueFull
        mine: asyncio.Future[None] = asyncio.get_running_loop().create_future()
        self._waiting.append(mine)
        deadline = time.monotonic() + timeout
        try:
            while not mine.done():
                yield self._waiting.index(mine) + 1
                left = deadline - time.monotonic()
                if left <= 0:
                    raise TimeoutError
                await asyncio.wait({mine}, timeout=min(0.5, left))
        finally:
            if not mine.done():
                mine.cancel()
            if mine in self._waiting:
                self._waiting.remove(mine)

    def release(self) -> None:
        """Hand the slot to the next one waiting, or free it."""
        while self._waiting:
            nxt = self._waiting.popleft()
            if not nxt.done():
                nxt.set_result(None)
                return
        self.active -= 1
