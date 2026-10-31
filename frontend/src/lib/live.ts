// The live feed (/api/live): the status snapshot, and the stage events of the kinds a page shows.

import { useCallback, useState } from "react";
import { type LiveEvent, type StageEvent, type Status, useEventStream } from "./api";

export function useLive(kinds: string[]) {
  const [status, setStatus] = useState<Status | null>(null);
  const [events, setEvents] = useState<StageEvent[]>([]);
  const key = kinds.join(",");

  useEventStream<LiveEvent>("/api/live", (event) => {
    if (event.type === "status") setStatus(event);
    else if (event.type === "stage" && key.split(",").includes(event.kind)) setEvents((e) => [...e, event]);
    else if (event.type === "gpu")
      setStatus((s) =>
        s && (event.service === "llm" || event.service === "forecaster")
          ? { ...s, gpu: { ...s.gpu, [event.service]: { ...s.gpu[event.service], available: event.available } } }
          : s,
      );
  });

  const take = useCallback((count: number) => setEvents((e) => e.slice(count)), []);
  /** Your own requests' events come through your own stream too: add them here (not shown twice). */
  return { status, events, take };
}
