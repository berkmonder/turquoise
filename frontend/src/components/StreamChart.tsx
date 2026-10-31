// The live chart: the signal scrolling in, the model's band of what's normal (past and the next 16 s), and
// visitors' points with their verdicts. Click anywhere to add a point.

import { type MouseEvent, useEffect, useRef, useState } from "react";

export type Band = { e: number; s: number; src: string };
export type Detection = {
  id: number;
  t: number;
  y: number;
  label: "normal" | "anomaly" | "pending"; // pending: placed in the future, judged when its moment comes
  z?: number;
  expected?: number;
  source?: string;
};

export type StreamState = {
  dt: number;
  visible: number;
  horizon: number;
  threshold: number;
  points: [number, number][];
  bands: Map<number, Band>;
  detections: Detection[];
  offset: number; // server clock − this browser's clock, in seconds
};

const W = 920;
const H = 360;
const M = { left: 38, right: 12, top: 12, bottom: 26 };
const Y_MIN = -3;
const Y_MAX = 3;

export function StreamChart(props: { data: StreamState; mine: Set<number>; onPoint: (t: number, y: number) => void }) {
  const { data, mine, onPoint } = props;
  const [, setFrame] = useState(0);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let id = 0;
    const loop = () => {
      setFrame((f) => (f + 1) % 1_000_000);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);

  const now = Date.now() / 1000 + data.offset;
  const t0 = now - data.visible;
  const t1 = now + data.horizon;
  const x = (t: number) => M.left + ((t - t0) / (t1 - t0)) * (W - M.left - M.right);
  const y = (v: number) => M.top + ((Y_MAX - v) / (Y_MAX - Y_MIN)) * (H - M.top - M.bottom);

  // The band, in runs of the same source (GPU or fallback).
  const steps = [...data.bands.keys()].filter((s) => s * data.dt >= t0 && s * data.dt <= t1).sort((a, b) => a - b);
  const runs: { src: string; steps: number[] }[] = [];
  for (const s of steps) {
    const b = data.bands.get(s)!;
    const last = runs[runs.length - 1];
    if (last && last.src === b.src && s - last.steps[last.steps.length - 1] <= 2) last.steps.push(s);
    else runs.push({ src: b.src, steps: last && last.src !== b.src ? [last.steps[last.steps.length - 1], s] : [s] });
  }
  const k = data.threshold;
  const bandPath = (r: number[]) => {
    const top = r.map((s) => `${x(s * data.dt).toFixed(1)},${y(data.bands.get(s)!.e + k * data.bands.get(s)!.s).toFixed(1)}`);
    const bottom = r
      .slice()
      .reverse()
      .map((s) => `${x(s * data.dt).toFixed(1)},${y(data.bands.get(s)!.e - k * data.bands.get(s)!.s).toFixed(1)}`);
    return `M${top.join("L")}L${bottom.join("L")}Z`;
  };
  const lastT = data.points.length ? data.points[data.points.length - 1][0] : now;
  const future = steps.filter((s) => s * data.dt >= lastT);
  const signal = data.points.filter(([t]) => t >= t0 - 1).map(([t, v]) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`);

  function click(event: MouseEvent<SVGSVGElement>) {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const px = ((event.clientX - box.left) / box.width) * W;
    const py = ((event.clientY - box.top) / box.height) * H;
    if (px < M.left || px > W - M.right || py < M.top || py > H - M.bottom) return;
    const t = t0 + ((px - M.left) / (W - M.left - M.right)) * (t1 - t0);
    const v = Y_MAX - ((py - M.top) / (H - M.top - M.bottom)) * (Y_MAX - Y_MIN);
    onPoint(t, Math.round(v * 1000) / 1000);
  }

  const ticks = [-60, -45, -30, -15, 0, 15];
  return (
    <svg ref={svg} className="stream" viewBox={`0 0 ${W} ${H}`} onClick={click} role="img" aria-label="Live signal with the model's normal band; click to add a point">
      <rect className="plot" x={M.left} y={M.top} width={W - M.left - M.right} height={H - M.top - M.bottom} />
      <rect className="future" x={x(lastT)} y={M.top} width={Math.max(0, W - M.right - x(lastT))} height={H - M.top - M.bottom} />
      {[-2, -1, 0, 1, 2].map((v) => (
        <g key={v}>
          <line className="grid" x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} />
          <text className="axis" x={M.left - 8} y={y(v) + 4} textAnchor="end">{v}</text>
        </g>
      ))}
      {ticks.map((s) => (
        <text key={s} className="axis" x={x(lastT + s)} y={H - 8} textAnchor="middle">
          {s === 0 ? "now" : `${s > 0 ? "+" : ""}${s}s`}
        </text>
      ))}
      {runs.map((r, i) => r.steps.length > 1 && <path key={i} className={`band band-${r.src}`} d={bandPath(r.steps)} />)}
      {future.length > 1 && (
        <polyline
          className="expected"
          points={future.map((s) => `${x(s * data.dt).toFixed(1)},${y(data.bands.get(s)!.e).toFixed(1)}`).join(" ")}
        />
      )}
      <polyline className="signal" points={signal.join(" ")} />
      <line className="now" x1={x(lastT)} x2={x(lastT)} y1={M.top} y2={H - M.bottom} />
      {data.detections
        .filter((d) => d.t >= t0 && d.t <= t1)
        .map((d) => (
          <g key={d.id} className={`det ${d.label}${mine.has(d.id) ? " mine" : ""}`}>
            {d.expected !== undefined && <line className="det-gap" x1={x(d.t)} x2={x(d.t)} y1={y(d.y)} y2={y(d.expected)} />}
            <circle cx={x(d.t)} cy={y(Math.max(Y_MIN, Math.min(Y_MAX, d.y)))} r={mine.has(d.id) ? 7 : 5.5} />
            {d.label === "anomaly" && d.z !== undefined && (
              <text x={x(d.t) + 9} y={y(Math.max(Y_MIN, Math.min(Y_MAX, d.y))) - 8}>
                {Math.abs(d.z).toFixed(1)}σ
              </text>
            )}
          </g>
        ))}
    </svg>
  );
}
