// The "behind the scenes" switch, open by default on wide screens; the choice is remembered.

import { useState } from "react";

const KEY = "turquoise.pipeline";

function initial(): boolean {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) return saved === "1";
  } catch {
    /* storage blocked */
  }
  return window.matchMedia("(min-width: 1100px)").matches;
}

export function usePanel(): [boolean, () => void] {
  const [open, setOpen] = useState(initial);
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(KEY, o ? "0" : "1");
      } catch {
        /* storage blocked */
      }
      return !o;
    });
  return [open, toggle];
}

export function PanelToggle(props: { open: boolean; onToggle: () => void }) {
  return (
    <button className={`toggle${props.open ? " on" : ""}`} onClick={props.onToggle} aria-pressed={props.open}>
      <span className="dot" /> {props.open ? "Hide" : "Show"} the pipeline
    </button>
  );
}
