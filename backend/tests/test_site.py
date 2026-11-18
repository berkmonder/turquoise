from app.site import SKIP, page_sections

PAGE = """<html><body><header><nav><a href="/">Home</a></nav></header>
<main><div class="content-panel"><h1 id="_top">Services</h1></div>
<div class="sl-markdown-content">
<p>I work with companies that want AI to do real work.</p>
<section class="section"><div class="sl-heading-wrapper level-h2"><h2 class="label" id="llm">LLM systems</h2>
<a class="sl-anchor-link" href="#llm"><span class="sr-only">Section titled “LLM systems”</span></a></div>
<div class="body"><ul><li>RAG assistants</li><li>Agents with tools</li></ul></div></section>
<script>console.log("not content")</script>
</div><footer>Last updated: today</footer></main></body></html>"""


def test_a_page_becomes_sections_under_its_title():
    found = page_sections(PAGE, "https://berkmonder.com/services/")
    assert [s.title for s in found] == ["Services", "Services › LLM systems"]
    assert found[0].text == "I work with companies that want AI to do real work."
    assert found[1].text == "RAG assistants\n\nAgents with tools"
    assert all(s.url == "https://berkmonder.com/services/" for s in found)
    noise = ("Section titled", "console", "Last updated")
    assert not any(n in s.text for n in noise for s in found)


def test_pages_that_arent_content_are_skipped():
    assert SKIP.search("https://berkmonder.com/status/")
    assert SKIP.search("https://berkmonder.com/apps/yap/privacy/")
    assert not SKIP.search("https://berkmonder.com/services/")


def test_the_home_page_is_called_home():
    html = "<main><h1>AI systems that work in production</h1><p>Hi.</p></main>"
    assert page_sections(html, "https://berkmonder.com/")[0].title == "Home"
