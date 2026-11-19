"""Search over text cut into sections: the agent's RAG (its search tools) and the quick answers when the
GPU is off. A question is matched two ways, by words (BM25) and by meaning (sentence embeddings, a small
model on the server's CPU), and the two rankings are merged (reciprocal rank fusion)."""

import re
import threading
import time
from dataclasses import dataclass
from functools import cache
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
    url: str | None = None  # where it comes from, for sections of the website


def sections(markdown: str, max_chars: int = 700, url: str | None = None) -> list[Section]:
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
                found.append(Section(title, part.strip(), url))
                part = ""
            part += paragraph + "\n\n"
        if part.strip():
            found.append(Section(title, part.strip(), url))

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


_loading = threading.Lock()


@cache
def embedder(model: str) -> Any:
    """The sentence-embedding model, loaded once and shared by every index."""
    from fastembed import TextEmbedding

    return TextEmbedding(model)


class SearchIndex:
    def __init__(self, found: list[Section], embedding_model: str | None = None) -> None:
        self.sections = found
        self._bm25 = BM25Okapi([words(f"{s.title} {s.text}") for s in found]) if found else None
        self._embedder: Any = None
        self._vectors: np.ndarray | None = None
        if embedding_model and found:  # embedding takes a few seconds: words alone until then
            threading.Thread(target=self._embed, args=(embedding_model,), daemon=True).start()

    def _embed(self, model: str) -> None:
        with _loading:
            model_ = embedder(model)
        vectors = np.array(list(model_.embed([f"{s.title}\n{s.text}" for s in self.sections])))
        self._vectors = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)
        self._embedder = model_

    @property
    def semantic(self) -> bool:
        return self._vectors is not None

    def search(self, query: str, k: int = 3) -> list[Section]:
        """The best `k` sections that have something to do with the query (none if nothing does)."""
        if self._bm25 is None:
            return []
        lexical = np.asarray(self._bm25.get_scores(words(query)))
        similarity = np.zeros(len(self.sections))
        if self._vectors is not None and self._embedder is not None:
            q = np.array(next(iter(self._embedder.query_embed(query))))
            similarity = self._vectors @ (q / np.linalg.norm(q))

        # Reciprocal rank fusion: a section near the top of either ranking rises.
        rankings = [lexical, similarity] if self.semantic else [lexical]
        fused = np.zeros(len(self.sections))
        for scores in rankings:
            ranks = np.empty(len(scores))
            ranks[np.argsort(-scores)] = np.arange(len(scores))
            fused += 1.0 / (60 + ranks)
        return [self.sections[i] for i in np.argsort(-fused)[:k]
                if lexical[i] > 0 or similarity[i] >= 0.62]


def timed(index: SearchIndex | None, query: str, k: int = 3) -> tuple[list[Section], float]:
    """`index.search`, and how long it took (ms)."""
    started = time.perf_counter()
    found = index.search(query, k) if index else []
    return found, round((time.perf_counter() - started) * 1000, 1)


REASONS = {
    "en": {
        "gpu_offline": "Berk's GPU is off right now (the PC is off, or busy with something else)",
        "busy": "every GPU slot is taken at the moment",
        "daily_limit": "today's GPU budget is used up",
        "gpu_error": "the model on Berk's GPU didn't answer",
        "not_configured": "the model isn't connected here",
    },
    "tr": {
        "gpu_offline": "Berk'in GPU'su şu an kapalı (bilgisayar kapalı ya da başka bir işle meşgul)",
        "busy": "şu an GPU'daki bütün yerler dolu",
        "daily_limit": "bugünkü GPU kotası doldu",
        "gpu_error": "Berk'in GPU'sundaki model cevap vermedi",
        "not_configured": "model buraya bağlı değil",
    },
}
WORDS = {
    "en": {
        "unavailable": "the model isn't available",
        "nothing": "I couldn't find that ({why}, so I can only search this website and Berk's CV). Try other "
        "words, or write to Berk: berkmonder@gmail.com.",
        "quick": "{why}, so this is a quick answer: what this website and Berk's CV say.",
        "page": "page",
    },
    "tr": {
        "unavailable": "model şu an kullanılamıyor",
        "nothing": "Bunu bulamadım ({why}; bu yüzden yalnızca bu sitede ve Berk'in özgeçmişinde "
        "arayabiliyorum). Başka kelimelerle deneyin ya da Berk'e yazın: berkmonder@gmail.com.",
        "quick": "{why}; bu yüzden bu hızlı bir cevap: bu sitenin ve Berk'in özgeçmişinin söyledikleri.",
        "page": "sayfa",
    },
}


def quick_answer(found: list[Section], reason: str, lang: str = "en") -> str:
    """The answer without a language model: what was found, as it is, and why (in English or Turkish)."""
    words = WORDS.get(lang, WORDS["en"])
    why = REASONS.get(lang, REASONS["en"]).get(reason, words["unavailable"])
    if not found:
        return words["nothing"].format(why=why)
    parts = [words["quick"].format(why=f"{why[0].upper()}{why[1:]}")]
    for section in found:
        quoted = "\n".join(f"> {line}" if line else ">" for line in section.text.splitlines())
        source = f" ([{words['page']}]({section.url}))" if section.url else ""
        parts.append(f"**{section.title}**{source}\n{quoted}")
    return "\n\n".join(parts)
