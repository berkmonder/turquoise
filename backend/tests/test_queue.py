import asyncio

import pytest

from app.chat.queue import QueueFull, SlotQueue


async def take(queue: SlotQueue, timeout: float = 5.0) -> list[int]:
    places = []
    async for place in queue.turn(timeout):
        places.append(place)
    return places


async def test_free_slots_need_no_wait():
    queue = SlotQueue(slots=2, max_waiting=5)
    assert await take(queue) == [] and await take(queue) == []
    assert queue.active == 2


async def test_waiters_go_in_order_and_see_their_place():
    queue = SlotQueue(slots=1, max_waiting=5)
    await take(queue)
    first = asyncio.create_task(take(queue))
    second = asyncio.create_task(take(queue))
    await asyncio.sleep(0.05)
    assert queue.waiting == 2
    queue.release()
    assert await first == [1]
    assert not second.done()
    queue.release()
    assert (await second)[0] == 2
    queue.release()
    assert queue.active == 0


async def test_a_full_line_refuses():
    queue = SlotQueue(slots=1, max_waiting=1)
    await take(queue)
    waiter = asyncio.create_task(take(queue))
    await asyncio.sleep(0.05)
    with pytest.raises(QueueFull):
        await take(queue)
    waiter.cancel()


async def test_waiting_too_long_gives_up_and_leaves_the_line():
    queue = SlotQueue(slots=1, max_waiting=5)
    await take(queue)
    with pytest.raises(TimeoutError):
        await take(queue, timeout=0.2)
    assert queue.waiting == 0
