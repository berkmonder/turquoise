// "Contact Berk": a visitor leaves their email; Berk's phone hears at once.

import { type FormEvent, useState } from "react";
import { postJson } from "../lib/api";

export function ContactForm(props: { conversationId: string | null; onClose: () => void }) {
  const [state, setState] = useState<"editing" | "sending" | "sent">("editing");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("sending");
    setError("");
    try {
      await postJson("/api/contact", {
        name: String(form.get("name") ?? "").trim(),
        email: String(form.get("email") ?? "").trim(),
        message: String(form.get("message") ?? "").trim(),
        conversation_id: props.conversationId,
      });
      setState("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setState("editing");
    }
  }

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="contact-title" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={props.onClose} aria-label="Close">
          ×
        </button>
        <h2 id="contact-title">Contact Berk</h2>
        {state === "sent" ? (
          <p>Thanks: Berk got it on his phone just now and will get back to you by email.</p>
        ) : (
          <form onSubmit={submit}>
            <label>
              Your name
              <input name="name" required maxLength={100} autoFocus />
            </label>
            <label>
              Your email
              <input name="email" type="email" required maxLength={200} />
            </label>
            <label>
              Message <span className="muted">(optional)</span>
              <textarea name="message" rows={4} maxLength={1500} placeholder="The role, the team, a good time to talk…" />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="primary" disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : "Send to Berk"}
            </button>
            <p className="notice">Kept for 90 days, used only so Berk can reply.</p>
          </form>
        )}
      </div>
    </div>
  );
}
