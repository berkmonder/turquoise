// The two systems as diagrams: their boxes, what each one does, and how a live event moves through them.

import type { Flow, PipeEdge, PipeNode } from "./components/Pipeline";

export const chatNodes: PipeNode[] = [
  {
    id: "visitor", label: "You", sub: "this page", x: 170, y: 32, where: "visitor",
    info: "Your question goes out as one HTTP request; the answer streams back word by word as server-sent events, so you see it being written.",
  },
  {
    id: "api", label: "Turquoise API", sub: "FastAPI · rate limits", x: 170, y: 122, where: "vps",
    info: "A FastAPI service on a small always-on VPS. It limits each visitor (10 messages in 5 minutes) and everyone together (a daily GPU budget), keeps the conversation for 90 days, and reports every step to this panel.",
  },
  {
    id: "router", label: "Router", sub: "GPU or fallback?", x: 170, y: 202, where: "vps",
    info: "Checks Berk's PC every 5 seconds over Tailscale. If it doesn't answer (off, asleep, or Berk is gaming) or its requests keep failing, questions go straight to the fallback: no waiting for timeouts.",
  },
  {
    id: "queue", label: "Queue", sub: "3 at a time", x: 90, y: 290, where: "vps",
    info: "The GPU answers 3 visitors at once (a 4th slot stays free for Berk). Anyone beyond that waits in line, first come first served, and sees their place. If the line is too long, the fallback answers instead.",
  },
  {
    id: "search", label: "CV search", sub: "BM25 + embeddings", x: 255, y: 290, where: "vps",
    info: "The fallback: no language model. The CV is cut into sections and matched two ways, by words (BM25) and by meaning (bge-small sentence embeddings on the CPU); the rankings are merged (reciprocal rank fusion) and the best sections are shown as they are.",
  },
  {
    id: "gateway", label: "LiteLLM gateway", sub: "one key, one model", x: 90, y: 400, where: "pc",
    info: "Alperen's gateway: every client of the GPU goes through it. Turquoise's key can use only this agent's model, a few requests at a time, and asks it to keep no logs.",
  },
  {
    id: "engine", label: "llama.cpp", sub: "Qwen3.5-9B · batched", x: 90, y: 480, where: "pc",
    info: "Qwen3.5-9B on an RTX 3060. Its 4 slots decode together, one batch per step, so several visitors cost little more than one. The CV and the agent's rules are in the prompt; it answers only from them.",
  },
];

export const chatEdges: PipeEdge[] = [
  { from: "visitor", to: "api" },
  { from: "api", to: "router" },
  { from: "router", to: "queue" },
  { from: "router", to: "search" },
  { from: "queue", to: "gateway" },
  { from: "gateway", to: "engine" },
  { from: "engine", to: "visitor", back: true },
  { from: "search", to: "visitor", back: true },
];

export const chatFlow: Flow = (e, at) => {
  switch (e.stage) {
    case "received":
      return ["visitor", "api"];
    case "router":
      return at === "router" ? null : ["api", "router"];
    case "queue":
      return at === "queue" ? null : ["router", "queue"];
    case "gpu":
      if (e.status === "active") return [at ?? "queue", "gateway", "engine"];
      if (e.status === "done") return ["engine", "visitor"];
      return null;
    case "fallback":
      return e.status === "done" ? ["search", "visitor"] : [at ?? "router", "search"];
    default:
      return null;
  }
};

export const anomalyNodes: PipeNode[] = [
  {
    id: "generator", label: "Signal", sub: "4 points / second", x: 90, y: 40, where: "vps",
    info: "Three sines whose periods relate by the golden ratio, so the curve never repeats, plus slow smooth noise (an Ornstein-Uhlenbeck process). Smooth and predictable, so an odd point stands out.",
  },
  {
    id: "buffer", label: "Window", sub: "last 64 seconds", x: 90, y: 120, where: "vps",
    info: "The model sees the last 256 points (64 seconds) each time it forecasts.",
  },
  {
    id: "router", label: "Router", sub: "GPU or fallback?", x: 90, y: 200, where: "vps",
    info: "Every second, the next 16 seconds are forecast: on Berk's GPU if it's there, otherwise on the server. The band's colour on the chart says which one made it.",
  },
  {
    id: "chronos", label: "Chronos-Bolt", sub: "pretrained · GPU", x: 90, y: 305, where: "pc",
    info: "Amazon's Chronos-Bolt, a pretrained time-series foundation model, on Berk's RTX 3060. It returns quantiles (10%, 50%, 90%), and the band is built from them.",
  },
  {
    id: "ar", label: "Robust AR", sub: "fitted live · CPU", x: 255, y: 200, where: "vps",
    info: "The fallback: an autoregressive model refitted every second (least squares, reweighted so outliers barely count). Its band is calibrated on the errors it really made forecasting its own recent past.",
  },
  {
    id: "band", label: "Normal band", sub: "expected ± 3σ", x: 255, y: 120, where: "vps",
    info: "For each moment, the expected value and how sure the model is. A point more than 3 standard deviations away is an anomaly. The band never gets thinner than a click's precision.",
  },
  {
    id: "visitor", label: "Your click", sub: "a point anywhere", x: 255, y: 305, where: "visitor",
    info: "Click anywhere on the chart, past or future, to add a point. Only visitors' points are judged, never the generated signal.",
  },
  {
    id: "detector", label: "Detector", sub: "z-score vs band", x: 255, y: 390, where: "vps",
    info: "Your point is compared with the band the model had for that moment: z = (value − expected) / σ. Further than 3 is an anomaly.",
  },
  {
    id: "broadcast", label: "Everyone", sub: "live stream", x: 90, y: 390, where: "visitor",
    info: "The verdict goes to everyone watching, over server-sent events: you see other visitors' points appear too.",
  },
];

export const anomalyEdges: PipeEdge[] = [
  { from: "generator", to: "buffer" },
  { from: "buffer", to: "router" },
  { from: "router", to: "chronos" },
  { from: "router", to: "ar" },
  { from: "chronos", to: "band" },
  { from: "ar", to: "band" },
  { from: "visitor", to: "detector" },
  { from: "band", to: "detector", back: true },
  { from: "detector", to: "broadcast" },
];

export const anomalyFlow: Flow = (e) => {
  if (e.stage === "forecast") return ["generator", "buffer", "router", e.source === "gpu" ? "chronos" : "ar", "band"];
  if (e.stage === "detect") return e.status === "done" ? ["detector", "broadcast"] : ["visitor", "detector"];
  return null;
};
