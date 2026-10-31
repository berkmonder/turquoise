from pathlib import Path

from app.chat.search import ProfileSearch, answer, sections

CV = (Path(__file__).parent.parent / "profile" / "cv.md").read_text()


def test_sections_follow_headings():
    found = sections("# Name\n\nIntro.\n\n## Experience\n\n### Acme\n\nBuilt things.\n\n## Skills\n\nPython")
    assert [s.title for s in found] == ["Profile", "Experience › Acme", "Skills"]
    assert found[1].text == "Built things."


def test_words_find_the_right_section():
    search = ProfileSearch(CV)
    results, timings = search.search("Does he know PyTorch?")
    assert results and results[0][0].title == "Skills"
    assert "bm25" in timings


def test_nothing_relevant_says_so():
    search = ProfileSearch(CV)
    results, _ = search.search("zebra migration patterns")
    assert results == []
    assert "couldn't find" in answer(results, "gpu_offline")


def test_answer_quotes_sections_and_says_why():
    search = ProfileSearch(CV)
    results, _ = search.search("anomaly detection experience")
    text = answer(results, "busy")
    assert text.startswith("Every GPU slot is taken")
    assert "> " in text and "Contact Berk" in text
