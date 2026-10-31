# Turquoise

**Production ML, live:** https://turquoise.berkmonder.com

Live demos of production ML systems you can use, each with a panel that shows every request moving
through the system as it happens:

- **Ask about Berk** (`/ask`): an LLM agent that knows Berk's CV, for recruiters. It runs on Berk's home
  GPU and serves several visitors in one batch, queueing the rest. When the GPU isn't available, a
  search over the CV answers instead (no AI), and every answer says which one served it. Interested
  visitors can leave their email; Berk's phone hears at once.
- **Live anomaly detection** (`/anomaly`): a smooth, never-repeating signal streams in; every second a
  forecasting model (Chronos-Bolt on the GPU, or a robust autoregression on the server) draws a band of
  what's normal. Visitors click anywhere to add a point and see it judged, live, by everyone watching.
- **The API** (`/developers`, reference at `/api/docs`): ask the agent, or find anomalies in your own
  series.

How it's built and why: [docs/architecture.md](docs/architecture.md).

## Layout

| Path | What |
|---|---|
| `backend/` | the API (FastAPI, Python 3.12, uv): `app/chat/` the agent, its queue and fallback search; `app/anomaly/` the stream, forecasts and detection; `app/live.py` the pipeline feed |
| `backend/profile/cv.md` | **Berk's CV**, the agent's only knowledge (and the fallback's). Keep its `##`/`###` headings: the search cuts it into sections there |
| `backend/tests/` | `uv run pytest` |
| `frontend/` | the web app (Vite, React, TypeScript): `src/pages/` the pages, `src/components/Pipeline.tsx` the live panel, `src/pipelines.ts` what each box does |
| `.github/workflows/` | `api.yml` and `web.yml`: checks, then on `main` build, smoke-test and push the images to the VPS |

## Run it locally

```bash
cd backend && uv sync && uv run uvicorn app.main:app --port 8000   # settings: ../.env.example
cd frontend && npm install && npm run dev                            # http://localhost:5173, /api goes to :8000
```

Without a gateway the chat answers from the CV search; without a forecaster the anomaly demo uses the
CPU. To use Berk's GPU, set `GATEWAY_URL`/`GATEWAY_KEY` and `FORECASTER_URL`/`FORECASTER_KEY` (the keys:
`scripts/secret.sh alperen-turquoise-gateway-key` and `alperen-forecaster-key` in Alperen's repository).

## Deploy

Push to `main`: CI checks it (ruff, ty, tests), builds the images, starts each one and checks it
answers, then publishes it to GitHub's registry (`ghcr.io/berkmonder/turquoise`, `turquoise-web`). The
VPS copies each new version into its own registry and runs it within about 4 minutes, and goes back to
the previous image if it isn't healthy.

How it runs on the VPS (domain, environment, secrets, health check) is in
[nix-dotfiles](https://github.com/berkmonder/nix-dotfiles): `hosts/vps/apps.nix`, entries `turquoise`
(the API) and `turquoise-web` (this web app). The GPU side is Alperen on Berk's PC: the model `about`
behind its LiteLLM gateway, and its forecaster service.
