"""The website as the agent's sources: Berk's CV, the Markdown the site serves at /files/cv.md (in the
site's repository: cv/cv.md, also built into the PDF), and berkmonder.com's pages (listed in its sitemap),
each cut into sections at its headings. Re-read every hour, so a CV change, a new page or a blog post is
searchable without a deploy."""

import asyncio
import logging
import re
from html.parser import HTMLParser
from urllib.parse import urlsplit

import httpx

from .config import settings
from .search import SearchIndex, Section, sections
from .state import state

log = logging.getLogger("turquoise.site")

# Not content: the 404 page, the app's legal pages, the live status board (it fills itself in the browser).
SKIP = re.compile(r"/(404|apps/|status)")
HEADINGS = {"h1": 1, "h2": 2, "h3": 3, "h4": 4}
BLOCKS = {"p", "li", "dt", "dd", "td", "th", "pre", "blockquote", "summary", *HEADINGS}
IGNORED = {"script", "style", "svg", "nav", "button", "noscript", "footer", "template"}


class MainText(HTMLParser):
    """A page's <main> as markdown-ish text: headings become `#` lines (one level deeper, so the page's
    title heads its sections), everything else paragraphs."""

    def __init__(self) -> None:
        super().__init__()
        self.in_main = 0
        self.ignored: list[str] = []  # open tags whose text doesn't count
        self.block = "p"
        self.text: list[str] = []
        self.lines: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "main":
            self.in_main += 1
        classes = (dict(attrs).get("class") or "").split()
        if self.ignored or tag in IGNORED or {"sr-only", "sl-anchor-link"} & set(classes):
            self.ignored.append(tag)
        elif self.in_main and tag in BLOCKS:
            self._flush()
            self.block = tag

    def handle_endtag(self, tag: str) -> None:
        if self.ignored:
            if self.ignored[-1] == tag:
                self.ignored.pop()
            return
        if tag in BLOCKS or tag == "main":
            self._flush()
            self.block = "p"
        if tag == "main":
            self.in_main -= 1

    def handle_data(self, data: str) -> None:
        if self.in_main and not self.ignored:
            self.text.append(data)

    def _flush(self) -> None:
        text = " ".join("".join(self.text).split())
        self.text.clear()
        if text:
            level = HEADINGS.get(self.block)
            self.lines.append(f"{'#' * (level + 1)} {text}" if level else text)

    def markdown(self) -> str:
        self._flush()
        return "\n\n".join(self.lines)


def page_sections(html: str, url: str) -> list[Section]:
    parser = MainText()
    parser.feed(html)
    text = parser.markdown()
    if urlsplit(url).path in ("", "/"):  # the home page's title is its headline: call it what it is
        text = re.sub(r"^## .*", "## Home", text, count=1)
    return sections(text, url=url)


async def page_urls(client: httpx.AsyncClient, site: str) -> list[str]:
    """Every page in the sitemap (the index, then the sitemaps it lists)."""
    index = (await client.get(f"{site}/sitemap-index.xml", timeout=10)).text
    urls: list[str] = []
    for sitemap in re.findall(r"<loc>(.*?)</loc>", index):
        listed = (await client.get(site + urlsplit(sitemap).path, timeout=10)).text
        urls += re.findall(r"<loc>(.*?)</loc>", listed)
    return [u for u in urls if not SKIP.search(u)][:300]


async def build_index(client: httpx.AsyncClient, site: str) -> SearchIndex:
    gate = asyncio.Semaphore(4)

    async def fetch(url: str) -> list[Section]:
        # Read from `site` (a local copy, in development), link to the address the sitemap gives.
        async with gate:
            response = await client.get(site + urlsplit(url).path, timeout=10)
        return page_sections(response.text, url) if response.status_code == 200 else []

    pages = await asyncio.gather(*(fetch(u) for u in await page_urls(client, site)))
    return SearchIndex([s for page in pages for s in page], settings.embedding_model or None)


async def read_cv(client: httpx.AsyncClient, site: str) -> SearchIndex:
    """Berk's CV, cut into sections at its `##`/`###` headings."""
    response = await client.get(f"{site}/files/cv.md", timeout=10)
    response.raise_for_status()
    return SearchIndex(sections(response.text), settings.embedding_model or None)


async def keep_fresh() -> None:
    """Read the CV and the site now and every hour; a failed read keeps the last index."""
    site = settings.site_url.rstrip("/")
    while True:
        try:
            state.profile = await read_cv(state.client, site)
            log.info("cv: %d sections", len(state.profile.sections))
        except httpx.HTTPError as error:
            log.warning("cv: not read (%s), keeping the last one", error)
        try:
            state.site = await build_index(state.client, site)
            log.info("website: %d sections", len(state.site.sections))
        except httpx.HTTPError as error:
            log.warning("website: not read (%s), keeping the last index", error)
        await asyncio.sleep(settings.site_refresh_s)
