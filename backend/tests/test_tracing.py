from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient
from mlflow.tracing.context import get_configured_trace_metadata, get_configured_trace_tags

from app import main, tracing
from app.main import app


@pytest.fixture
def connected(monkeypatch: pytest.MonkeyPatch) -> None:
    """As after `tracing.connect()`, without an MLflow to talk to."""
    monkeypatch.setattr(tracing.tracing, "model_id", "m-build")
    monkeypatch.setattr(tracing.tracing, "prompt_version", "3")


def test_before_mlflow_answers_nothing_is_added():
    with tracing.answer("chat-1", "/learn/llm/", "gpu"):
        assert get_configured_trace_metadata() is None


def test_an_answer_carries_its_chat_page_build_and_prompt(connected: None):
    with tracing.answer("chat-1", "/learn/llm/", "gpu"):
        metadata = get_configured_trace_metadata() or {}
        tags = get_configured_trace_tags() or {}
    assert metadata["mlflow.trace.session"] == "chat-1"
    assert metadata["mlflow.modelId"] == "m-build"
    assert tags["answer"] == "gpu" and tags["page"] == "/learn/llm/"
    assert tags["mlflow.linkedPrompts"] == '[{"name": "turquoise-instructions", "version": "3"}]'


def test_when_the_pc_is_off_the_answer_is_not_traced(connected: None):
    with tracing.answer("chat-1", None, "gpu_offline"):
        assert get_configured_trace_metadata() is None


def test_the_chat_streams_inside_its_trace(monkeypatch: pytest.MonkeyPatch):
    seen: list[tuple] = []

    @contextmanager
    def answer(chat, page, kind):
        seen.append((chat, page, kind))
        yield

    monkeypatch.setattr(main.tracing, "answer", answer)
    body = {"trigger": "submit-message", "id": "chat-7",
            "messages": [{"id": "m0", "role": "user", "parts": [{"type": "text", "text": "Who is Berk?"}]}]}
    with TestClient(app) as client:
        response = client.post("/api/chat", json=body, headers={"x-turquoise-page": "/about/"})
    assert response.status_code == 200
    assert seen == [("chat-7", "/about/", "not_configured")]
