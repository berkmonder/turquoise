"""The fallback when the GPU can't answer: no language model, only search. Berk's profile is cut into
sections; a question is matched against them two ways, by words (BM25) and by meaning (sentence
embeddings, a small model on the VPS's CPU), and the two rankings are merged (reciprocal rank fusion).
The best sections are shown as they are."""

import re
import threading
import time
from dataclasses import dataclass
from typing import Any

import numpy as np
from rank_bm25 import BM25Okapi

STOPWORDS = set(
    "a an and are as at be by can did do does for from has have he his how i in is it its me my of on "
    "or our s she that the their them they this to was we were what when where which who why will "
    "with you your about tell does berk".split()
)


def words(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9+#.]+", text.lower()) if w not in STOPWORDS]


@dataclass
class Section:
    title: str  # its headings, e.g. "Experience › Acme"
    text: str


def sections(markdown: str, max_chars: int = 700) -> list[Section]:
    """Cut a markdown document at its headings; long parts are cut again at blank lines."""
    found: list[Section] = []
    path: list[str] = []
    lines: list[str] = []

    def flush() -> None:
        body = "\n".join(lines).strip()
        lines.clear()
        if not body:
            return
        title = " › ".join(path) or "Profile"
        part = ""
        for paragraph in re.split(r"\n\s*\n", body):
            if part and len(part) + len(paragraph) > max_chars:
                found.append(Section(title, part.strip()))
                part = ""
            part += paragraph + "\n\n"
        if part.strip():
            found.append(Section(title, part.strip()))

    for line in markdown.splitlines():
        heading = re.match(r"^(#{1,6})\s+(.*)", line)
        if heading:
            flush()
            level = len(heading.group(1))
            del path[max(level - 2, 0):]  # the document title (#) isn't part of the path
            if level > 1:
                path.append(heading.group(2).strip())
        else:
            lines.append(line)
    flush()
    return found


class ProfileSearch:
    def __init__(self, markdown: str, embedding_model: str | None = None) -> None:
        self.sections = sections(markdown)
        self._bm25 = BM25Okapi([words(f"{s.title} {s.text}") for s in self.sections])
        self._embedder: Any = None
        self._vectors: np.ndarray | None = None
        if embedding_model:  # loading the model takes a few seconds: words alone until then
            threading.Thread(target=self._load, args=(embedding_model,), daemon=True).start()

    def _load(self, model: str) -> None:
        from fastembed import TextEmbedding

        embedder = TextEmbedding(model)
        texts = [f"{s.title}\n{s.text}" for s in self.sections]
        vectors = np.array(list(embedder.embed(texts)))
        self._vectors = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)
        self._embedder = embedder

    @property
    def semantic(self) -> bool:
        return self._vectors is not None

    def search(self, query: str, k: int = 3) -> tuple[list[tuple[Section, float]], dict[str, float]]:
        """The best `k` sections (with their similarity) and how long each step took, in ms."""
        timings: dict[str, float] = {}
        if not self.sections:
            return [], timings
        t = time.perf_counter()
        lexical = np.asarray(self._bm25.get_scores(words(query)))
        timings["bm25"] = (time.perf_counter() - t) * 1000

        similarity = np.zeros(len(self.sections))
        if self._vectors is not None and self._embedder is not None:
            t = time.perf_counter()
            q = np.array(next(iter(self._embedder.query_embed(query))))
            timings["embed"] = (time.perf_counter() - t) * 1000
            similarity = self._vectors @ (q / np.linalg.norm(q))

        # Reciprocal rank fusion: a section near the top of either ranking rises.
        rankings = [lexical, similarity] if "embed" in timings else [lexical]
        fused = np.zeros(len(self.sections))
        for scores in rankings:
            ranks = np.empty(len(scores))
            ranks[np.argsort(-scores)] = np.arange(len(scores))
            fused += 1.0 / (60 + ranks)
        order = np.argsort(-fused)[:k]

        relevant = [
            (self.sections[i], float(similarity[i]))
            for i in order
            if lexical[i] > 0 or similarity[i] >= 0.62
        ]
        return relevant, timings


REASONS = {
    "gpu_offline": "Berk's GPU is offline right now (his PC is off, or he's using it)",
    "busy": "every GPU slot is taken at the moment",
    "daily_limit": "today's AI budget is used up",
    "gpu_error": "the AI on Berk's GPU didn't answer",
    "not_configured": "the AI isn't connected here",
}


def answer(results: list[tuple[Section, float]], reason: str) -> str:
    why = REASONS.get(reason, "the AI isn't available")
    if not results:
        return (f"I couldn't find that in Berk's CV ({why}, so I can only search it). "
                "Try other words, or ask Berk directly: **Contact Berk** below.")
    parts = [f"{why[0].upper()}{why[1:]}, so here's what Berk's CV says about that:"]
    for section, _ in results:
        quoted = "\n".join(f"> {line}" if line else ">" for line in section.text.splitlines())
        parts.append(f"**{section.title}**\n{quoted}")
    parts.append("Want to ask Berk directly? Use **Contact Berk** below.")
    return "\n\n".join(parts)
