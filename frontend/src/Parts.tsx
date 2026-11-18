// One answer, step by step: the agent's thinking and its tool calls are collapsed lines you can open
// (what it thought, what it searched for and what came back); the answer itself is markdown.

import type { DynamicToolUIPart, ReasoningUIPart, UIMessage } from "ai";
import Markdown from "react-markdown";
import { PulseIcon, SearchIcon, ThinkIcon } from "./icons";

type Found = { title: string; text: string; url?: string };
type Status = { gpu: string; sites: { name: string; status: string; uptime_30_days: string }[] | string };

const TOOLS: Record<string, { running: string; done: string }> = {
  search_profile: { running: "Searching Berk's CV", done: "Searched Berk's CV" },
  search_site: { running: "Searching berkmonder.com", done: "Searched berkmonder.com" },
  get_status: { running: "Checking live status", done: "Checked live status" },
};

/** A tool call, whichever way the stream labelled it (`tool-<name>` or `dynamic-tool`). */
type ToolPart = Pick<DynamicToolUIPart, "toolCallId" | "state" | "input" | "output" | "errorText"> & {
  toolName: string;
};

function toolPart(part: UIMessage["parts"][number]): ToolPart | null {
  if (part.type === "dynamic-tool") return part;
  if (part.type.startsWith("tool-") && "toolCallId" in part) {
    return { ...(part as unknown as ToolPart), toolName: part.type.slice(5) };
  }
  return null;
}

function Thought({ part, seconds }: { part: ReasoningUIPart; seconds?: number }) {
  const thinking = part.state === "streaming";
  const label = thinking ? "Thinking…" : seconds ? `Thought for ${seconds}s` : "Thought";
  return (
    <details className="tq-step">
      <summary className={thinking ? "tq-live" : undefined}>
        <ThinkIcon />
        <span>{label}</span>
      </summary>
      <div className="tq-step-body tq-thought">{part.text}</div>
    </details>
  );
}

function Tool({ part }: { part: ToolPart }) {
  const names = TOOLS[part.toolName] ?? { running: `Using ${part.toolName}`, done: `Used ${part.toolName}` };
  const running = part.state === "input-streaming" || part.state === "input-available";
  const query = (part.input as { query?: string } | undefined)?.query;
  const found = Array.isArray(part.output) ? (part.output as Found[]) : null;
  const count = found ? ` · ${found.length === 0 ? "nothing found" : `${found.length} found`}` : "";
  return (
    <details className="tq-step">
      <summary className={running ? "tq-live" : undefined}>
        {part.toolName === "get_status" ? <PulseIcon /> : <SearchIcon />}
        <span>
          {running ? names.running : names.done}
          {query && <code>{query}</code>}
          {!running && count}
          {part.state === "output-error" && " · failed"}
        </span>
      </summary>
      <div className="tq-step-body">
        {found?.map((f, i) => (
          <article key={i} className="tq-found">
            <h4>
              {f.title}
              {f.url && (
                <a href={f.url} className="tq-page">
                  page ↗
                </a>
              )}
            </h4>
            <p>{f.text}</p>
          </article>
        ))}
        {part.toolName === "get_status" && part.output != null && <StatusOutput status={part.output as Status} />}
        {part.state === "output-error" && <p>{part.errorText}</p>}
        {running && <p>Waiting for the result…</p>}
      </div>
    </details>
  );
}

function StatusOutput({ status }: { status: Status }) {
  return (
    <ul className="tq-status">
      <li>Berk's GPU: {status.gpu}</li>
      {Array.isArray(status.sites)
        ? status.sites.map((s) => (
            <li key={s.name}>
              {s.name}: {s.status} ({s.uptime_30_days} over 30 days)
            </li>
          ))
        : <li>Sites: {status.sites}</li>}
    </ul>
  );
}

export default function Parts({ message, thoughts }: { message: UIMessage; thoughts: Record<string, number> }) {
  return (
    <>
      {message.parts.map((part, i) => {
        if (part.type === "reasoning") {
          return part.text.trim() ? <Thought key={i} part={part} seconds={thoughts[`${message.id}:${i}`]} /> : null;
        }
        if (part.type === "text") {
          return (
            <div key={i} className="tq-text">
              <Markdown>{part.text}</Markdown>
            </div>
          );
        }
        const tool = toolPart(part);
        return tool ? <Tool key={tool.toolCallId} part={tool} /> : null;
      })}
    </>
  );
}
