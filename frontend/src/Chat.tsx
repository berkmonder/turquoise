// The chat: the conversation with Turquoise and the box to ask in. It talks to /api/chat with the
// Vercel AI SDK's `useChat`, which reads the agent's stream (thinking, tool calls and their results, the
// answer) into message parts; `Parts` shows them. The conversation lasts for the browser tab.

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { NewIcon, SendIcon } from "./icons";
import { pagePath, pageWords, type Words } from "./page";
import Parts from "./Parts";

const STORE = "turquoise-chat";

type Saved = { messages: UIMessage[]; thoughts: Record<string, number> };

function load(): Saved {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) ?? "null");
    if (Array.isArray(saved?.messages)) return saved;
  } catch {}
  return { messages: [], thoughts: {} };
}

/** "Too many messages…" out of the API's JSON error, or a sentence of our own. */
function readable(error: Error, words: Words): string {
  try {
    const detail = JSON.parse(error.message).detail;
    if (typeof detail === "string") return detail;
  } catch {}
  return words.unreachable;
}

type Health = "checking" | "gpu" | "quick" | "offline";

/** Is Berk's GPU on? Checked now and every 30 seconds. */
function useHealth(): Health {
  const [health, setHealth] = useState<Health>("checking");
  useEffect(() => {
    const check = () =>
      fetch("/api/status")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((s) => setHealth(s.gpu?.llm?.available ? "gpu" : "quick"))
        .catch(() => setHealth("offline"));
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, []);
  return health;
}

export default function Chat({ autoFocus = false }: { autoFocus?: boolean }) {
  const saved = useMemo(load, []);
  const words = useMemo(pageWords, []);
  // Every question says which page it was asked on, so the assistant knows what "this page" is.
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", headers: () => ({ "X-Turquoise-Page": pagePath() }) }),
    [],
  );
  const { messages, sendMessage, setMessages, status, error, clearError, stop } = useChat({
    id: "turquoise",
    messages: saved.messages,
    transport,
  });
  const [draft, setDraft] = useState("");
  const thoughts = useRef<Record<string, number>>(saved.thoughts);
  const started = useRef<Record<string, number>>({});
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const health = useHealth();
  const busy = status === "submitted" || status === "streaming";

  // How long each thought took: from its first word to its last.
  for (const message of messages) {
    message.parts.forEach((part, i) => {
      if (part.type !== "reasoning") return;
      const key = `${message.id}:${i}`;
      if (part.state === "streaming") started.current[key] ??= Date.now();
      else if (started.current[key] && thoughts.current[key] === undefined)
        thoughts.current[key] = Math.max(1, Math.round((Date.now() - started.current[key]) / 1000));
    });
  }

  useEffect(() => {
    if (busy) return;
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ messages, thoughts: thoughts.current }));
    } catch {}
  }, [messages, busy]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages, status]);

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  function ask(text: string) {
    if (!text.trim() || busy) return;
    clearError();
    sendMessage({ text: text.trim() });
    setDraft("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(draft);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(draft);
    }
  }

  function startOver() {
    stop();
    setMessages([]);
    thoughts.current = {};
    clearError();
  }

  const subtitle = words.status[health];

  return (
    <section className="tq tq-chat" aria-label={words.dialog}>
      <header className="tq-head">
        <span className={`tq-dot ${health}`} aria-hidden="true" />
        <div className="tq-title">
          <h2>Turquoise</h2>
          <p>{subtitle}</p>
        </div>
        {messages.length > 0 && (
          <button type="button" className="tq-icon-button" onClick={startOver} aria-label={words.newChat} title={words.newChat}>
            <NewIcon />
          </button>
        )}
      </header>

      <div className="tq-messages" ref={list} aria-live="polite">
        <div className="tq-message assistant">
          <p>{words.greeting}</p>
        </div>
        {messages.length === 0 && (
          <div className="tq-suggestions">
            {words.suggestions.map((s) => (
              <button type="button" key={s} onClick={() => ask(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="tq-message user">
              {message.parts.map((p) => (p.type === "text" ? p.text : "")).join("")}
            </div>
          ) : (
            <div key={message.id} className="tq-message assistant">
              <Parts message={message} thoughts={thoughts.current} words={words} />
            </div>
          ),
        )}
        {status === "submitted" && <div className="tq-message assistant tq-waiting">{words.thinking}</div>}
        {error && <p className="tq-error">{readable(error, words)}</p>}
      </div>

      <form className="tq-input" onSubmit={onSubmit}>
        <textarea
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          maxLength={800}
          placeholder={words.placeholder}
          aria-label={words.question}
        />
        <button type="submit" className="tq-send" disabled={busy || !draft.trim()} aria-label={words.send}>
          <SendIcon />
        </button>
      </form>
    </section>
  );
}
