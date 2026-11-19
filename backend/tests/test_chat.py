import json
from typing import cast

import pytest
from fastapi import Request
from fastapi.testclient import TestClient
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
)
from pydantic_ai.models.function import AgentInfo, FunctionModel

from app import main
from app.agent import agent
from app.main import app
from app.search import SearchIndex, Section
from app.state import state


def ask(text: str, history: list[dict] | None = None) -> dict:
    """A chat request as the Vercel AI SDK's `useChat` sends it."""
    message = {"id": f"m{len(history or [])}", "role": "user", "parts": [{"type": "text", "text": text}]}
    return {"trigger": "submit-message", "id": "chat", "messages": [*(history or []), message]}


def chunks(text: str) -> list[dict]:
    return [json.loads(line[6:]) for line in text.splitlines()
            if line.startswith("data: ") and line != "data: [DONE]"]


def test_without_the_gpu_the_quick_answer_shows_its_searches():
    with TestClient(app) as client:
        response = client.post("/api/chat", json=ask("What are Berk's skills?"))
        assert response.status_code == 200
        got = chunks(response.text)
        calls = {c["toolCallId"]: c["toolName"] for c in got if c["type"] == "tool-input-available"}
        assert sorted(calls.values()) == ["search_profile", "search_site"]
        outputs = {calls[c["toolCallId"]]: c["output"] for c in got if c["type"] == "tool-output-available"}
        assert any(r["title"] == "Skills" for r in outputs["search_profile"])
        assert outputs["search_site"] == []  # no website in tests
        text = "".join(c["delta"] for c in got if c["type"] == "text-delta")
        assert "quick answer" in text and "model isn't connected" in text and "**Skills**" in text


async def test_the_agent_searches_then_answers_from_what_it_found():
    tools: list[str] = []

    def model(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        tools.extend(t.name for t in info.function_tools)
        returned = [p for m in messages if isinstance(m, ModelRequest)
                    for p in m.parts if isinstance(p, ToolReturnPart)]
        if not returned:
            return ModelResponse(parts=[ToolCallPart("search_profile", {"query": "PyTorch"})])
        return ModelResponse(parts=[TextPart(f"Found {cast(list[dict], returned[0].content)[0]['title']}.")])

    with TestClient(app):  # loads the profile
        result = await agent.run("Does Berk know PyTorch?", model=FunctionModel(model))
    assert result.output == "Found Skills."
    assert {"search_profile", "search_site", "get_status"} <= set(tools)


def test_the_gpu_path_holds_a_slot_and_gives_it_back(monkeypatch: pytest.MonkeyPatch):
    async def stream(messages: list[ModelMessage], info: AgentInfo):
        yield "From the GPU."

    monkeypatch.setattr(type(state.llm), "configured", property(lambda self: True))
    monkeypatch.setattr(type(state.llm), "available", property(lambda self: True))
    monkeypatch.setattr(main, "gpu_model", lambda page=None: FunctionModel(stream_function=stream))
    with TestClient(app) as client:
        response = client.post("/api/chat", json=ask("Hello"), headers={"x-forwarded-for": "198.51.100.1"})
        text = "".join(c["delta"] for c in chunks(response.text) if c["type"] == "text-delta")
        assert text == "From the GPU."
    assert state.queue.active == 0


def test_requests_are_checked():
    with TestClient(app) as client:
        headers = {"x-forwarded-for": "198.51.100.2"}
        assert client.post("/api/chat", json=ask("x" * 900), headers=headers).status_code == 422
        assert client.post("/api/chat", json=ask("   "), headers=headers).status_code == 422
        assert client.post("/api/chat", content=b"not json", headers=headers).status_code == 422


def test_visitors_are_limited():
    with TestClient(app) as client:
        headers = {"x-forwarded-for": "203.0.113.9"}
        codes = [client.post("/api/chat", json=ask("hi"), headers=headers).status_code for _ in range(12)]
        assert codes.count(429) == 2


def test_status_says_whether_the_gpu_is_on():
    with TestClient(app) as client:
        got = client.get("/api/status").json()
        assert got["gpu"]["llm"]["available"] is False
        assert got["sources"]["profile"] > 10


def test_the_quick_answer_reads_the_visitors_page_in_its_language():
    site = [Section("Altyapı › Neler var", "Linux ve konteynerler.", "https://berkmonder.com/learn/altyapi/")]
    state.site = SearchIndex(site)
    try:
        with TestClient(app) as client:
            headers = {"x-turquoise-page": "/learn/altyapi/", "x-forwarded-for": "198.51.100.3"}
            response = client.post("/api/chat", json=ask("Bu sayfayı özetle"), headers=headers)
        got = chunks(response.text)
        calls = {c["toolName"] for c in got if c["type"] == "tool-input-available"}
        assert "read_page" in calls
        text = "".join(c["delta"] for c in got if c["type"] == "text-delta")
        assert "hızlı bir cevap" in text and "Linux ve konteynerler." in text
    finally:
        state.site = None


def test_the_page_header_is_only_a_path():
    def page(value: str) -> str | None:
        return main.page_of(Request({"type": "http", "headers": [(b"x-turquoise-page", value.encode())]}))

    assert page("/learn/llm/?x=1#top") == "/learn/llm/"
    assert page("https://evil.example/") is None
    assert page("//evil.example/") is None
