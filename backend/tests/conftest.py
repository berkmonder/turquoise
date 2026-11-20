"""Tests run without the GPU, the website or the embedding model: settings come from here, before the
app is imported. Berk's CV comes from tests/cv.md, a copy of the one the site serves."""

import os
from pathlib import Path

import pytest

os.environ["LLM_URL"] = ""
os.environ["SITE_URL"] = ""
os.environ["EMBEDDING_MODEL"] = ""

CV = (Path(__file__).parent / "cv.md").read_text()


@pytest.fixture(autouse=True)
def cv() -> None:
    from app.search import SearchIndex, sections
    from app.state import state

    state.profile = SearchIndex(sections(CV))
