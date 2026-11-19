# Turquoise

**The assistant on Berk's website:** an agent that answers questions about the page you're reading, the
lessons and posts there, and Berk, on
[berkmonder.com](https://berkmonder.com) (the chat in the corner of every page, and full-size at
[berkmonder.com/turquoise](https://berkmonder.com/turquoise/)).

- **An agent with tools and RAG.** Built with [Pydantic AI](https://ai.pydantic.dev). It knows which page
  you're on and can read it (`read_page`), searches the website (`search_site`) and Berk's CV
  (`search_profile`), checks what's up (`get_status`), and answers from what it found.
- **It shows its work.** The chat streams every step: the model's thinking, each tool call with what came
  back, then the answer. Thinking and tool calls are collapsed lines you can open, as in a coding agent.
- **On Berk's own GPU.** The model (Qwen3.5 9B) runs on Berk's PC behind LiteLLM, which traces every call
  in MLflow. When the PC is off or busy, the same agent gives quick answers from search alone, and says so.

How it's built and why: [docs/architecture.md](docs/architecture.md).

## Layout

| Path | What |
|---|---|
| `backend/app/agent.py` | the agent: its instructions, tools and models (the GPU, and the quick-answer stand-in) |
| `backend/app/main.py` | the API: `POST /api/chat` (limits, the GPU queue, then the agent's stream), `GET /api/status` |
| `backend/app/search.py`, `site.py` | the RAG: sections of the CV and of the website's pages, searched by words and meaning |
| `backend/profile/cv.md` | **Berk's CV**, one of the agent's two sources. Keep its `##`/`###` headings: search cuts it there |
| `frontend/src/` | the chat (React, the Vercel AI SDK's `useChat`), built into one script: `/widget/turquoise.js` |
| `.github/workflows/` | `api.yml` and `web.yml`: checks, then on `main` build, smoke-test and publish the images |

## Run it locally

```bash
cd backend && uv sync && uv run uvicorn app.main:app --port 8000   # settings: ../.env.example
cd frontend && npm install && npm run dev                            # http://localhost:5173: a playground
```

The playground shows the chat inline; `?bubble` shows it as the corner button. Without `LLM_URL` and
`LLM_KEY` (turquoise's key at the PC's LiteLLM, in nix-dotfiles' `hosts/desktop/secrets.yaml`) every
answer is a quick answer.

**Change what it does:** add a tool in `agent.py` (a typed Python function with a docstring: the model
sees both); the chat shows it like the others (give it labels in `frontend/src/Parts.tsx`).

## Put it on a page

```html
<script type="module" src="/widget/turquoise.js"></script>
```

That's the bottom-right button. A `<div data-turquoise-inline></div>` on the page shows the chat there
instead, and any link to `#ask` opens the button's chat. It takes its colors and fonts from the page
(Starlight's variables), its language from `<html lang>` (Turkish or English), and calls `/api` on the
page's own domain, saying which page it's on (`X-Turquoise-Page`). A page can set the button's label and
the suggested questions:

```html
<meta name="turquoise:label" content="Ask about Berk">
<meta name="turquoise:suggestions" content="First question|Second question|Third question">
```

## Deploy

Push to `main`: CI checks it (ruff, ty, tests; type-check and build), builds the images, starts each one
and checks it answers, then publishes it to GitHub's registry (`ghcr.io/berkmonder/turquoise`,
`turquoise-web`). The VPS runs each new version within about 4 minutes and goes back to the previous
image if it isn't healthy. On the VPS (nix-dotfiles: `hosts/vps/apps.nix`), berkmonder.com sends `/api`
to the API and `/widget` to the chat's files; turquoise.berkmonder.com redirects to
berkmonder.com/turquoise.
