// "Live anomaly detection": a signal streams in, a model forecasts a band of what's normal, and visitors'
// points are judged against it as they click.

import { useRef, useState } from "react";
import { GpuPill } from "../components/GpuPill";
import { PanelToggle, usePanel } from "../components/PanelToggle";
import { Pipeline } from "../components/Pipeline";
import { type Detection, StreamChart, type StreamState } from "../components/StreamChart";
import { postJson, useEventStream } from "../lib/api";
import { useLive } from "../lib/live";
import { anomalyEdges, anomalyFlow, anomalyNodes } from "../pipelines";

const NOBODY = new Set<string>(); // the forecasts aren't anyone's requests

type StreamEvent =
  | {
      type: "snapshot";
      dt: number;
      now: number;
      visible: number;
      horizon: number;
      threshold: number;
      points: [number, number][];
      bands: [number, number, number, string][];
      detections: Detection[];
    }
  | { type: "point"; t: number; y: number }
  | { type: "forecast"; t0: number; dt: number; expected: number[]; sigma: number[]; source: string; threshold: number }
  | ({ type: "detection" } & Detection);

export function Anomaly() {
  const data = useRef<StreamState | null>(null);
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<string>("");
  const [toast, setToast] = useState<{ text: string; kind: string } | null>(null);
  const [mine, setMine] = useState<Set<number>>(new Set());
  const mineRef = useRef(new Set<number>());
  const waiting = useRef(new Set<number>()); // my points still in the future
  const toastTimer = useRef(0);
  const [panel, togglePanel] = usePanel();
  const live = useLive(["anomaly"]);

  useEventStream<StreamEvent>("/api/anomaly/stream", (e) => {
    if (e.type === "snapshot") {
      const bands = new Map(e.bands.map(([t, ex, s, src]) => [Math.round(t / e.dt), { e: ex, s, src }]));
      data.current = {
        dt: e.dt, visible: e.visible, horizon: e.horizon, threshold: e.threshold,
        points: e.points, bands, detections: e.detections, offset: e.now - Date.now() / 1000,
      };
      setReady(true);
      return;
    }
    const d = data.current;
    if (!d) return;
    if (e.type === "point") {
      d.points.push([e.t, e.y]);
      const keep = e.t - d.visible - 5;
      while (d.points.length && d.points[0][0] < keep) d.points.shift();
      d.offset = 0.9 * d.offset + 0.1 * (e.t - Date.now() / 1000);
    } else if (e.type === "forecast") {
      const first = Math.round(e.t0 / e.dt);
      e.expected.forEach((ex, h) => d.bands.set(first + h, { e: ex, s: e.sigma[h], src: e.source }));
      const oldest = first - Math.round((d.visible + 5) / d.dt);
      for (const s of d.bands.keys()) if (s < oldest) d.bands.delete(s);
      setSource(e.source);
    } else if (e.type === "detection") {
      d.detections = [...d.detections.filter((x) => x.id !== e.id), e].slice(-150);
      if (e.label !== "pending" && mineRef.current.has(e.id) && waiting.current.has(e.id)) {
        waiting.current.delete(e.id);
        verdict(e);
      }
    }
  });

  function show(text: string, kind: string) {
    setToast({ text, kind });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }

  function verdict(d: Detection) {
    const away = Math.abs(d.z ?? 0).toFixed(1);
    if (d.label === "anomaly") show(`Anomaly: ${away}σ from what the model expected`, "anomaly");
    else show(`Normal: ${away}σ from the expected value`, "normal");
  }

  async function add(t: number, y: number) {
    try {
      const d = await postJson<Detection>("/api/anomaly/points", { t, y });
      mineRef.current.add(d.id);
      setMine(new Set(mineRef.current));
      if (d.label === "pending") {
        waiting.current.add(d.id);
        const lastT = data.current?.points.at(-1)?.[0] ?? t;
        show(`Waiting: judged when that moment comes, in ${Math.max(1, Math.round(t - lastT))} s`, "pending");
      } else {
        verdict(d);
      }
    } catch (e) {
      show(e instanceof Error ? e.message : "Couldn't add that point.", "error");
    }
  }

  const forecaster = live.status?.gpu.forecaster;
  const offline = new Set(forecaster && forecaster.configured && !forecaster.available ? ["chronos"] : []);
  if (forecaster && !forecaster.configured) offline.add("chronos");

  return (
    <div className={`demo${panel ? " with-panel" : ""}`}>
      <section className="anomaly">
        <header className="demo-head">
          <div>
            <h1>Live anomaly detection</h1>
            <p className="muted">
              A signal streams in, four points a second. Every second a model forecasts the next 16 seconds with a band of
              what's normal. <strong>Click anywhere on the chart</strong> to add a point: inside the band it's normal,
              outside it's an anomaly. A point in the forecast zone waits until its moment comes, then is
              judged. Everyone watching sees your points too.
            </p>
          </div>
          <div className="head-actions">
            <GpuPill state={forecaster} />
            <PanelToggle open={panel} onToggle={togglePanel} />
          </div>
        </header>

        <div className="chart-card">
          {ready && data.current ? (
            <StreamChart data={data.current} mine={mine} onPoint={(t, y) => void add(t, y)} />
          ) : (
            <div className="loading">Connecting to the stream…</div>
          )}
          {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
        </div>

        <div className="legend">
          <span><i className="sw signal" /> the signal</span>
          <span><i className="sw band-gpu" /> band by Chronos-Bolt (GPU)</span>
          <span><i className="sw band-fallback" /> band by robust AR (fallback, CPU)</span>
          <span><i className="sw normal" /> normal point</span>
          <span><i className="sw anomaly" /> anomaly, with its distance in σ</span>
          <span><i className="sw pending" /> waiting for its moment</span>
        </div>
        <p className="muted small">
          Forecasting now:{" "}
          {source === "gpu" ? "Chronos-Bolt on Berk's RTX 3060" : source ? "robust autoregression on the server (the GPU isn't available)" : "…"}.
          Only visitors' points are judged, never the generated signal. Your own points have a ring.
        </p>
      </section>

      {panel && (
        <aside className="panel">
          <h2>Behind the scenes</h2>
          <Pipeline
            nodes={anomalyNodes}
            edges={anomalyEdges}
            flow={anomalyFlow}
            events={live.events}
            onTaken={live.take}
            mine={NOBODY}
            offline={offline}
            badges={{}}
            height={430}
          />
          {live.status && (
            <dl className="today">
              <div><dt>Points judged today</dt><dd>{live.status.today.detections}</dd></div>
              <div><dt>Watching</dt><dd>{live.status.watchers}</dd></div>
            </dl>
          )}
        </aside>
      )}
    </div>
  );
}
