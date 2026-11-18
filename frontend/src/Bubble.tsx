// The chat as a button in the bottom-right corner. The same button opens and closes it; Escape closes
// it too. Any link to "#ask" opens it.

import { useEffect, useState } from "react";
import Chat from "./Chat";
import { ChatIcon, CloseIcon } from "./icons";

export default function Bubble() {
  const [open, setOpen] = useState(() => sessionStorage.getItem("turquoise-open") === "1");

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
        <div className="tq-panel" role="dialog" aria-label="Turquoise, Berk's assistant">
          <Chat autoFocus />
        </div>
      )}
      <button
        type="button"
        className="tq-launcher"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? "Close the chat" : "Ask about Berk"}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
        {!open && <span>Ask about Berk</span>}
      </button>
    </div>
  );
}
