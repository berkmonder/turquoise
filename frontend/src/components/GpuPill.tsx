// Is Berk's GPU there right now?

import type { GpuState } from "../lib/api";

export function GpuPill({ state, label = "GPU" }: { state?: GpuState; label?: string }) {
  if (!state) return <span className="pill">{label}: …</span>;
  if (!state.configured) return <span className="pill off">{label}: not connected</span>;
  return state.available ? (
    <span className="pill on" title="Berk's PC answers: heavy work runs on its RTX 3060">
      {label} online
    </span>
  ) : (
    <span className="pill off" title="Berk's PC is off, asleep or busy with a game: the fallback answers">
      {label} offline · fallback on
    </span>
  );
}
