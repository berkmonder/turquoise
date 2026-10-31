// The front page: what turquoise is, the demos, and how it's built.

import { Link } from "react-router-dom";
import { GpuPill } from "../components/GpuPill";
import { useLive } from "../lib/live";

export function Home() {
  const live = useLive([]);
  return (
    <div className="home">
      <section className="hero">
        <p className="eyebrow">Turquoise · by Berk Önder</p>
        <h1>Production ML, live.</h1>
        <p className="lead">
          Real systems you can use, not screenshots: an LLM agent served from a home GPU to many people at once, and
          real-time anomaly detection on a streaming signal. Open the pipeline panel on any demo to watch every request
          move through the system as it happens.
        </p>
        <div className="hero-status">
          <GpuPill state={live.status?.gpu.llm} label="LLM on the GPU" />
          <GpuPill state={live.status?.gpu.forecaster} label="Forecaster on the GPU" />
        </div>
      </section>

      <section className="cards">
        <Link to="/ask" className="card">
          <span className="card-kicker">Demo 1 · LLM serving</span>
          <h2>Ask about Berk</h2>
          <p>
            An agent that knows his CV, answering recruiters live. Batched on an RTX 3060, queued when busy, and a search
            fallback when the GPU is off: every answer says which one served it.
          </p>
          <span className="card-cta">Ask a question →</span>
        </Link>
        <Link to="/anomaly" className="card">
          <span className="card-kicker">Demo 2 · time series</span>
          <h2>Live anomaly detection</h2>
          <p>
            A signal streams in; a forecasting model draws a band of what's normal for the next 16 seconds. Click anywhere
            to add a point and see it judged, live, by Chronos-Bolt on the GPU or a robust fallback.
          </p>
          <span className="card-cta">Try it →</span>
        </Link>
        <Link to="/developers" className="card">
          <span className="card-kicker">For your code</span>
          <h2>The API</h2>
          <p>Ask the agent, or find anomalies in your own series, with one HTTP request. Rate-limited, nothing stored.</p>
          <span className="card-cta">Read the docs →</span>
        </Link>
      </section>

      <section className="how">
        <h2>How it's built</h2>
        <ul>
          <li>
            <strong>Two machines.</strong> The site and its API run on a small always-on VPS. Heavy work runs on Berk's
            PC (an RTX 3060), reached over an encrypted Tailscale tunnel.
          </li>
          <li>
            <strong>Never down because of the GPU.</strong> The VPS checks the PC every 5 seconds. When it's off, asleep
            or busy with a game, requests go to a lighter fallback on the VPS at once, and say so.
          </li>
          <li>
            <strong>Many people at once.</strong> The LLM engine decodes several conversations in one batch; beyond that,
            visitors queue and see their place in line.
          </li>
          <li>
            <strong>Run like production.</strong> Rate limits, a daily GPU budget, health checks, an outside uptime check,
            metrics in Grafana, load tests, and a deploy on every push. Infrastructure as code (NixOS, Terraform).
          </li>
        </ul>
      </section>
    </div>
  );
}
