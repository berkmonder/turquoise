"""Every answer as a trace in MLflow, on Berk's PC (experiment `turquoise`), so MLflow shows turquoise as
an app:

- **Traces:** one per answer: the agent's run, each model call, each tool call with what it returned
  (MLflow's Pydantic AI autolog). Quick answers too; the tag `answer` says which kind it was.
- **Sessions:** the chat's id (`useChat` makes one per conversation) is the trace's session, so a
  conversation reads as one. Nothing identifies the visitor.
- **Prompts:** `INSTRUCTIONS` are the prompt `turquoise-instructions`, with a new version when they
  change. Git stays where they're written; the registry mirrors them.
- **Agent versions:** this build is `turquoise-<commit>`, linked to its prompt version. Every trace says
  which build answered.

The PC is often off. Until MLflow answers, tracing stays off and is tried again every few minutes. Once
on, traces are sent in the background, and one that can't be sent is dropped: tracing never slows or
breaks an answer. Quick answers given because the PC is off aren't traced: there's nowhere to send them.
Off entirely when MLFLOW_TRACKING_URI is empty (locally, and in the tests)."""

import asyncio
import contextlib
import json
import logging
import os
from collections.abc import Generator
from dataclasses import dataclass

import mlflow
from mlflow import MlflowClient
from mlflow.tracing.constant import TraceMetadataKey, TraceTagKey
from pydantic_ai import Agent

from .agent import INSTRUCTIONS
from .config import settings

log = logging.getLogger("turquoise.tracing")

EXPERIMENT = "turquoise"
PROMPT = "turquoise-instructions"

# Sent in the background; when the PC is off, given up after a short try instead of MLflow's default
# (7 retries, 120 s each).
os.environ.setdefault("MLFLOW_ENABLE_ASYNC_TRACE_LOGGING", "true")
os.environ.setdefault("MLFLOW_HTTP_REQUEST_MAX_RETRIES", "2")
os.environ.setdefault("MLFLOW_HTTP_REQUEST_TIMEOUT", "10")
logging.getLogger("urllib3.connectionpool").setLevel(logging.ERROR)  # each retry; MLflow says what failed


@dataclass
class Tracing:
    """What every trace carries once MLflow answered: this build, and its prompt's version."""

    model_id: str | None = None
    prompt_version: str | None = None


tracing = Tracing()


def connect() -> None:
    """Find or make, in MLflow: the experiment, the prompt's version, this build. Then trace."""
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    experiment = mlflow.set_experiment(EXPERIMENT).experiment_id
    latest = mlflow.genai.load_prompt(f"prompts:/{PROMPT}@latest", allow_missing=True)
    if latest is None or latest.template != INSTRUCTIONS:
        latest = mlflow.genai.register_prompt(PROMPT, INSTRUCTIONS, commit_message=settings.git_commit)
    build = this_build(experiment)
    MlflowClient().link_prompt_version_to_model(PROMPT, str(latest.version), build)
    Agent.instrument_all()  # the agent reports its steps (Pydantic AI), which autolog turns into spans
    mlflow.pydantic_ai.autolog(silent=True)
    tracing.model_id, tracing.prompt_version = build, str(latest.version)


def this_build(experiment: str) -> str:
    """This build as an agent version (a logged model): found by its name, or made. (Not
    `mlflow.set_active_model`, which would need pandas.)"""
    client = MlflowClient()
    name = f"turquoise-{settings.git_commit[:7]}"
    if found := client.search_logged_models([experiment], filter_string=f"name = '{name}'", max_results=1):
        return found[0].model_id
    model = client.create_logged_model(experiment, name=name, model_type="agent",
                                       tags={"mlflow.source.git.commit": settings.git_commit})
    return client.finalize_logged_model(model.model_id, "READY").model_id


async def keep_trying() -> None:
    """Connect once MLflow answers: at startup, then every 5 minutes until it does."""
    while True:
        try:
            await asyncio.to_thread(connect)
            log.info("MLflow: tracing to %s", settings.mlflow_tracking_uri)
            return
        except Exception as error:  # noqa: BLE001 - the PC is off, or MLflow isn't up yet
            log.warning("MLflow: not reached (%s), tracing stays off for now", error)
            await asyncio.sleep(300)


@contextlib.contextmanager
def answer(chat: str | None, page: str | None, kind: str) -> Generator[None]:
    """Around one answer: its trace gets the chat as its session, the page and the kind of answer (`gpu`,
    or why it's a quick one), this build and its prompt's version."""
    if tracing.model_id is None:  # not connected: nothing is traced yet
        yield
        return
    if kind == "gpu_offline":  # the PC is off: there's nowhere to send the trace
        with mlflow.tracing.context(enabled=False):
            yield
        return
    tags = {"answer": kind, "page": page or "",
            TraceTagKey.LINKED_PROMPTS: json.dumps([{"name": PROMPT, "version": tracing.prompt_version}])}
    with mlflow.tracing.context(session_id=chat, tags=tags,
                                metadata={TraceMetadataKey.MODEL_ID: tracing.model_id}):
        yield
