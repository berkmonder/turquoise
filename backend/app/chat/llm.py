"""The GPU path: Alperen's gateway on Berk's PC (OpenAI-compatible), answers streamed word by word."""

import json
from collections.abc import AsyncIterator

import httpx

from ..gpu import GpuService


class GatewayError(Exception):
    pass


async def stream(client: httpx.AsyncClient, service: GpuService, model: str,
                 messages: list[dict[str, str]]) -> AsyncIterator[str]:
    body = {
        "model": model,
        "messages": messages,
        "stream": True,
        "temperature": 0.3,
        "no-log": True,  # the gateway keeps nothing; turquoise keeps the chat for 90 days
    }
    timeout = httpx.Timeout(connect=3.0, read=30.0, write=10.0, pool=5.0)
    async with client.stream("POST", f"{service.url}/v1/chat/completions", json=body,
                             headers=service.headers, timeout=timeout) as response:
        if response.status_code != 200:
            detail = (await response.aread())[:200].decode(errors="replace")
            raise GatewayError(f"{response.status_code}: {detail}")
        async for line in response.aiter_lines():
            if not line.startswith("data: "):
                continue
            data = line[6:].strip()
            if data == "[DONE]":
                return
            try:
                choice = json.loads(data)["choices"][0]
            except (ValueError, KeyError, IndexError):
                continue
            text = (choice.get("delta") or {}).get("content")
            if text:
                yield text
