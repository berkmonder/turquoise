import { createRoot } from "react-dom/client";
import Bubble from "./Bubble";
import Chat from "./Chat";
import css from "./chat.css?inline";

export function mount() {
  if (document.getElementById("turquoise-style")) return; // loaded twice
  const style = document.createElement("style");
  style.id = "turquoise-style";
  style.textContent = css;
  document.head.append(style);

  const inline = document.querySelectorAll<HTMLElement>("[data-turquoise-inline]");
  for (const element of inline) createRoot(element).render(<Chat />);
  if (inline.length === 0) {
    const element = document.createElement("div");
    document.body.append(element);
    createRoot(element).render(<Bubble />);
  }
}
