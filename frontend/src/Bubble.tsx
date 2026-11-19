// The chat as a button in the bottom-right corner. The same button opens and closes it; Escape closes
// it too. Any link to "#ask" opens it. Its label is the page's (see page.ts).

import { useEffect, useState } from "react";
import Chat from "./Chat";
import { ChatIcon, CloseIcon } from "./icons";
import { pageWords } from "./page";

export default function Bubble() {
  const [open, setOpen] = useState(() => sessionStorage.getItem("turquoise-open") === "1");
  const words = pageWords();

  useEffect(() => {
    sessionStorage.setItem("turquoise-open", open ? "1" : "0");
  }, [open]);

  useEffect(() => {
    const onHash = () => {
      if (location.hash !== "#ask") return;
      setOpen(true);
      history.replaceState(null, "", location.pathname + location.search);
    };
    onHash();
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="tq tq-bubble" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      {open && (
        <div className="tq-panel" role="dialog" aria-label={words.dialog}>
          <Chat autoFocus />
        </div>
      )}
      <button
        type="button"
        className="tq-launcher"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? words.close : words.label}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
        {!open && <span>{words.label}</span>}
      </button>
    </div>
  );
}
