from pathlib import Path

from app.search import SearchIndex, Section, quick_answer, sections

CV = (Path(__file__).parent.parent / "profile" / "cv.md").read_text()


def test_sections_follow_headings():
    found = sections("# Name\n\nIntro.\n\n## Experience\n\n### Acme\n\nBuilt things.\n\n## Skills\n\nPython")
    assert [s.title for s in found] == ["Profile", "Experience › Acme", "Skills"]
    assert found[1].text == "Built things."


def test_words_find_the_right_section():
    found = SearchIndex(sections(CV)).search("Does Berk know PyTorch?")
    assert found and found[0].title == "Skills"


def test_questions_land_on_their_section():
    index = SearchIndex(sections(CV))
    assert index.search("where did berk study")[0].title == "Education"
    assert index.search("how much does it cost")[0].title == "Services › How an engagement works"
    assert index.search("can you train our team on agents")[0].title == "Services › Training for teams"


def test_nothing_relevant_finds_nothing():
    assert SearchIndex(sections(CV)).search("zebra migration patterns") == []
    assert "couldn't find" in quick_answer([], "gpu_offline")


def test_quick_answer_quotes_sections_says_why_and_links_pages():
    text = quick_answer([Section("Services › Training", "Workshops.", "https://berkmonder.com/services/"),
                         Section("Skills", "Python")], "busy")
    assert text.startswith("Every GPU slot is taken")
    assert "> Workshops." in text and "([page](https://berkmonder.com/services/))" in text
