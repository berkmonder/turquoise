from app.search import SearchIndex, Section, quick_answer, sections

from .conftest import CV


def test_sections_follow_headings():
    found = sections("# Name\n\nIntro.\n\n## Experience\n\n### Acme\n\nBuilt things.\n\n## Skills\n\nPython")
    assert [s.title for s in found] == ["Profile", "Experience › Acme", "Skills"]
    assert found[1].text == "Built things."


def test_words_find_the_right_section():
    found = SearchIndex(sections(CV)).search("Does Berk know PyTorch?")
    assert found and found[0].title == "Skills"


def test_questions_land_on_their_section():
    index = SearchIndex(sections(CV))
    assert index.search("which university did berk attend")[0].title.startswith("Education ›")
    assert index.search("what did berk do at teknasyon")[0].title.startswith("Experience › MLOps Engineer")
    assert index.search("tell me about turquoise")[0].title.startswith("Projects › Turquoise")


def test_nothing_relevant_finds_nothing():
    assert SearchIndex(sections(CV)).search("zebra migration patterns") == []
    assert "couldn't find" in quick_answer([], "gpu_offline")


def test_quick_answer_quotes_sections_says_why_and_links_pages():
    text = quick_answer([Section("Services › Training", "Workshops.", "https://berkmonder.com/services/"),
                         Section("Skills", "Python")], "busy")
    assert text.startswith("Every GPU slot is taken")
    assert "> Workshops." in text and "([page](https://berkmonder.com/services/))" in text
