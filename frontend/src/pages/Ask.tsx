// "Ask about Berk": the chat, and beside it the pipeline every question goes through, live.

import { type FormEvent, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { ContactForm } from "../components/ContactForm";
import { PanelToggle, usePanel } from "../components/PanelToggle";
import { Pipeline } from "../components/Pipeline";
import { GpuPill } from "../components/GpuPill";
import { postStream } from "../lib/api";
import { useLive } from "../lib/live";
import { chatEdges, chatFlow, chatNodes } from "../pipelines";

type Meta = { servedBy?: string; reason?: string | null; firstTokenMs?: number; place?: number; stage?: string };
type Msg = { role: "user" | "assistant"; content: string; meta?: Meta };

const SUGGESTIONS = [
  "What does Berk do?",
  "What has he built with LLMs?",
  "Has he worked with time series?",
  "What kind of role is he looking for?",
];

const REASONS: Record<string, string> = {
  gpu_offline: "the GPU is offline",
  busy: "every GPU slot was taken",
  daily_limit: "today's GPU budget is used up",
  gpu_error: "the GPU didn't answer",
  not_configured: "no GPU is connected here",
  cut_off: "the GPU stopped mid-answer",
};

function ordinal(n: number) {
  return n === 1 ? "next" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

function Served({ meta }: { meta: Meta }) {
  if (meta.place && !meta.servedBy) return <div className="served waiting">You're {ordinal(meta.place)} in line for the GPU…</div>;
  if (!meta.servedBy) return null;
  if (meta.servedBy === "gpu")
    return (
      <div className="served gpu">
        <span className="chip gpu">GPU</span> Qwen3.5-9B on Berk's RTX 3060
        {meta.firstTokenMs !== undefined && <> · first words in {(meta.firstTokenMs / 1000).toFixed(1)} s</>}
        {meta.reason === "cut_off" && <> · cut off</>}
      </div>
    );
  return (
    <div className="served fallback">
      <span className="chip fallback">Fallback</span> CV search on the server (no AI) · {REASONS[meta.reason ?? ""] ?? "the GPU isn't available"}
    </div>
  );
}

export function Ask() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversation, setConversation] = useState<string | null>(() => sessionStorage.getItem("turquoise.conversation"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [contact, setContact] = useState(false);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [panel, togglePanel] = usePanel();
  const live = useLive(["chat", "api"]);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function update(meta: Partial<Meta>, text = "") {
    setMessages((m) => {
      const last = m[m.length - 1];
      return [...m.slice(0, -1), { ...last, content: last.content + text, meta: { ...last.meta, ...meta } }];
    });
  }

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "", meta: {} }]);
    try {
      await postStream("/api/chat", { message: text, conversation_id: conversation }, (e) => {
        if (e.type === "conversation") {
          setConversation(String(e.id));
          sessionStorage.setItem("turquoise.conversation", String(e.id));
        } else if (e.type === "stage") {
          const rid = String(e.rid);
          setMine((s) => (s.has(rid) ? s : new Set(s).add(rid)));
          if (e.stage === "queue" && typeof e.position === "number") update({ place: e.position, stage: "queue" });
          else if (e.stage === "gpu" && e.status === "streaming") update({ firstTokenMs: Number(e.first_token_ms), stage: "gpu" });
          else update({ stage: String(e.stage) });
        } else if (e.type === "token") {
          update({}, String(e.text));
        } else if (e.type === "done") {
          update({ servedBy: String(e.served_by), reason: (e.reason as string | null) ?? null });
        }
      });
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const box = input.current;
    if (!box) return;
    void ask(box.value);
    box.value = "";
  }

  const llm = live.status?.gpu.llm;
  const offline = new Set(llm && llm.configured && !llm.available ? ["gateway", "engine"] : []);
  const q = live.status?.queue;
  const badges: Record<string, string> = q ? { queue: `${q.active}/${q.slots} busy · ${q.waiting} waiting` } : {};
  if (live.status && !live.status.search.semantic) badges.search = "BM25 (embeddings loading)";

  return (
    <div className={`demo${panel ? " with-panel" : ""}`}>
      <section className="chat">
        <header className="demo-head">
          <div>
            <h1>Ask about Berk</h1>
            <p className="muted">His agent answers from his CV: on his home GPU when it's free, from a search when it isn't.</p>
          </div>
          <div className="head-actions">
            <GpuPill state={llm} />
            <PanelToggle open={panel} onToggle={togglePanel} />
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 && (
            <div className="empty">
              <p>Recruiter, curious, or both? Try one of these:</p>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => void ask(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.role === "assistant" ? (
                <>
                  {m.content ? <Markdown>{m.content}</Markdown> : <span className="typing" aria-label="Thinking"><i /><i /><i /></span>}
                  {m.meta && <Served meta={m.meta} />}
                </>
              ) : (
                <p>{m.content}</p>
              )}
            </div>
          ))}
          <div ref={end} />
        </div>

        {error && <p className="error">{error}</p>}
        <form className="composer" onSubmit={submit}>
          <textarea
            ref={input}
            rows={2}
            maxLength={800}
            placeholder="Ask about his experience, skills, projects…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
          />
          <div className="composer-actions">
            <button type="button" className="secondary" onClick={() => setContact(true)}>
              Contact Berk
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Answering…" : "Ask"}
            </button>
          </div>
        </form>
        <p className="notice">
          Conversations are kept for 90 days to improve the agent, then deleted. Please don't share personal details.
        </p>
      </section>

      {panel && (
        <aside className="panel">
          <h2>Behind the scenes</h2>
          <Pipeline
            nodes={chatNodes}
            edges={chatEdges}
            flow={chatFlow}
            events={live.events}
            onTaken={live.take}
            mine={mine}
            offline={offline}
            badges={badges}
            height={520}
          />
          {live.status && (
            <dl className="today">
              <div><dt>Today</dt><dd>{live.status.today.chats} questions</dd></div>
              <div><dt>On the GPU</dt><dd>{live.status.today.gpu}</dd></div>
              <div><dt>Fallback</dt><dd>{live.status.today.fallback}</dd></div>
              <div><dt>Watching</dt><dd>{live.status.watchers}</dd></div>
            </dl>
          )}
        </aside>
      )}

      {contact && <ContactForm conversationId={conversation} onClose={() => setContact(false)} />}
    </div>
  );
}
