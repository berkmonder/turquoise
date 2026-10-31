// The pipeline panel: the system as a diagram, with every live request travelling through it as a green
// pulse (yours brighter). Click a box to read what it does and why it's built that way.

import { useEffect, useRef, useState } from "react";
import type { StageEvent } from "../lib/api";

export type PipeNode = {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  where: "visitor" | "vps" | "pc";
  info: string;
};

export type PipeEdge = { from: string; to: string; back?: boolean };

/** Where a request goes on this event: the boxes it passes through, starting where it was. */
export type Flow = (event: StageEvent, at: string | undefined) => string[] | null;

type Pulse = { id: number; from: string; to: string; start: number; mine: boolean };

const W = 150;
const H = 46;
const HOP_MS = 420;

export function Pipeline(props: {
  nodes: PipeNode[];
  edges: PipeEdge[];
  flow: Flow;
  events: StageEvent[]; // events not shown yet: the panel takes them, then calls onTaken(how many)
  onTaken: (count: number) => void;
  mine: Set<string>;
  offline: Set<string>;
  badges: Record<string, string>;
  height: number;
}) {
  const { nodes, edges, flow, events, onTaken, mine, offline, badges, height } = props;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const where = useRef(new Map<string, { node: string; until: number; mine: boolean }>());
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [now, setNow] = useState(performance.now());
  const [selected, setSelected] = useState<string | null>(null);
  const nextId = useRef(1);

  // New events: pulses along their path, and where each request now is.
  useEffect(() => {
    if (!events.length) return;
    const t = performance.now();
    const added: Pulse[] = [];
    for (const event of events) {
      const at = where.current.get(event.rid);
      const path = flow(event, at?.node);
      const isMine = mine.has(event.rid);
      if (path && path.length) {
        const start = Math.max(t, at?.until ?? t);
        for (let i = 0; i + 1 < path.length; i++) {
          added.push({ id: nextId.current++, from: path[i], to: path[i + 1], start: start + i * HOP_MS, mine: isMine });
        }
        where.current.set(event.rid, {
          node: path[path.length - 1],
          until: start + Math.max(0, path.length - 1) * HOP_MS,
          mine: isMine,
        });
      }
      if (event.stage === "done") {
        const left = where.current.get(event.rid);
        const rid = event.rid;
        window.setTimeout(() => where.current.delete(rid), Math.max(0, (left?.until ?? t) - t) + 600);
      }
    }
    if (added.length) setPulses((p) => [...p, ...added]);
    onTaken(events.length);
  }, [events, flow, mine, onTaken]);

  // Animate while anything moves; forget requests that went quiet.
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const t = performance.now();
      setNow(t);
      setPulses((p) => (p.some((x) => x.start + HOP_MS < t) ? p.filter((x) => x.start + HOP_MS >= t) : p));
      for (const [rid, w] of where.current) if (t - w.until > 60_000) where.current.delete(rid);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const busy = new Map<string, "mine" | "other">();
  for (const w of where.current.values()) {
    if (w.until <= now && (busy.get(w.node) !== "mine")) busy.set(w.node, w.mine ? "mine" : "other");
  }

  const centre = (id: string) => byId[id];
  const sel = selected ? byId[selected] : null;

  return (
    <div className="pipeline">
      <svg viewBox={`0 0 340 ${height}`} role="img" aria-label="The system's pipeline, live">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {(["vps", "pc"] as const).map((zone) => {
          const inZone = nodes.filter((n) => n.where === zone);
          if (!inZone.length) return null;
          const top = Math.min(...inZone.map((n) => n.y)) - H / 2 - 22;
          const bottom = Math.max(...inZone.map((n) => n.y)) + H / 2 + 10;
          const left = Math.min(...inZone.map((n) => n.x)) - W / 2 - 10;
          const right = Math.max(...inZone.map((n) => n.x)) + W / 2 + 10;
          return (
            <g key={zone}>
              <rect className={`zone zone-${zone}`} x={left} y={top} width={right - left} height={bottom - top} rx={12} />
              <text className="zone-label" x={left + 10} y={top + 15}>
                {zone === "vps" ? "VPS · Hetzner · always on" : "Berk's PC · RTX 3060 · over Tailscale"}
              </text>
            </g>
          );
        })}
        {edges.map((e) => {
          const a = centre(e.from);
          const b = centre(e.to);
          const off = offline.has(e.from) || offline.has(e.to);
          return (
            <line
              key={`${e.from}-${e.to}`}
              className={`edge${e.back ? " back" : ""}${off ? " off" : ""}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
            />
          );
        })}
        {nodes.map((n) => {
          const state = busy.get(n.id);
          const off = offline.has(n.id);
          return (
            <g
              key={n.id}
              className={`node node-${n.where}${state ? ` busy busy-${state}` : ""}${off ? " off" : ""}${selected === n.id ? " selected" : ""}`}
              onClick={() => setSelected(selected === n.id ? null : n.id)}
              tabIndex={0}
              role="button"
              aria-label={`${n.label}: ${n.sub}`}
              onKeyDown={(k) => (k.key === "Enter" || k.key === " ") && setSelected(selected === n.id ? null : n.id)}
            >
              <rect x={n.x - W / 2} y={n.y - H / 2} width={W} height={H} rx={9} />
              <text className="node-label" x={n.x} y={n.y - 4}>
                {n.label}
              </text>
              <text className="node-sub" x={n.x} y={n.y + 12}>
                {off ? "offline" : badges[n.id] ?? n.sub}
              </text>
            </g>
          );
        })}
        {pulses
          .filter((p) => p.start <= now)
          .map((p) => {
            const a = centre(p.from);
            const b = centre(p.to);
            const k = Math.min(1, (now - p.start) / HOP_MS);
            const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
            return (
              <circle
                key={p.id}
                className={`pulse${p.mine ? " mine" : ""}`}
                cx={a.x + (b.x - a.x) * e}
                cy={a.y + (b.y - a.y) * e}
                r={p.mine ? 6 : 4.5}
                filter="url(#glow)"
              />
            );
          })}
      </svg>
      <div className="pipeline-info" aria-live="polite">
        {sel ? (
          <>
            <strong>{sel.label}</strong>
            <p>{sel.info}</p>
          </>
        ) : (
          <p className="muted">
            Every green dot is a real request, live: yours are brighter. Click a box to see what it does
            and why.
          </p>
        )}
      </div>
    </div>
  );
}
