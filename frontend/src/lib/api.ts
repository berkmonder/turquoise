// Talking to turquoise's API: server-sent events, as a POST stream (the chat) or an EventSource (live feeds).

import { useEffect, useRef } from "react";

export type StageEvent = {
  type: "stage";
  kind: string;
  rid: string;
  stage: string;
  status: string;
  ms: number;
  [key: string]: unknown;
};

export type GpuState = { configured: boolean; available: boolean; since: number };

export type Status = {
  type: "status";
  gpu: { llm: GpuState; forecaster: GpuState };
  queue: { active: number; waiting: number; slots: number };
  today: { chats: number; gpu: number; fallback: number; detections: number };
  search: { semantic: boolean };
  watchers: number;
};

export type LiveEvent = StageEvent | Status | { type: "gpu"; service: string; available: boolean };

/** POST `body` to `url` and call `onEvent` for each server-sent event of the answer. */
export async function postStream(
  url: string,
  body: unknown,
  onEvent: (event: Record<string, unknown>) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    let detail = `${response.status}`;
    try {
      detail = (await response.json()).detail ?? detail;
    } catch {
      /* not JSON */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let end;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data: ")) onEvent(JSON.parse(line.slice(6)));
      }
    }
  }
}

/** Subscribe to a server-sent event stream for as long as the component is mounted. */
export function useEventStream<T>(url: string, onEvent: (event: T) => void): void {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  useEffect(() => {
    const source = new EventSource(url);
    source.onmessage = (message) => handler.current(JSON.parse(message.data) as T);
    return () => source.close();
  }, [url]);
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail;
    throw new Error(typeof detail === "string" ? detail : Array.isArray(detail) ? detail[0]?.msg : `${response.status}`);
  }
  return data as T;
}
