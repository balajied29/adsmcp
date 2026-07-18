"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentBlock, ChatMessage } from "./chat-types";
import { AuditCard, CampaignCard, RichText } from "./cards";

const SUGGESTIONS = [
  "Audit my account",
  "Launch a campaign to get more sales this month",
  "Where am I wasting spend?",
  "What would happen if I doubled my budget?",
];

function AgentAvatar() {
  return (
    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white">
      A
    </span>
  );
}

function Blocks({ blocks }: { blocks: AgentBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        if (b.type === "audit") return <AuditCard key={i} block={b} />;
        if (b.type === "campaign") return <CampaignCard key={i} block={b} />;
        return (
          <p key={i} className="text-sm leading-6 text-zinc-600">
            <RichText text={b.text} />
          </p>
        );
      })}
    </div>
  );
}

export function ChatUI({ greetingName }: { greetingName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || thinking) return;
    setInput("");
    // Flatten prior turns to text so the agent has conversational memory;
    // rich cards become short markers.
    const history = messages.map((m) => ({
      role: m.role,
      text: m.blocks
        .map((b) =>
          b.type === "text"
            ? b.text
            : b.type === "audit"
              ? `[showed audit card: score ${b.score}]`
              : `[showed campaign draft: ${b.title}]`,
        )
        .join("\n"),
    }));
    setMessages((m) => [...m, { role: "user", blocks: [{ type: "text", text: content }] }]);
    setThinking(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history }),
      });
      const json = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          blocks: res.ok
            ? (json.blocks as AgentBlock[])
            : [{ type: "text", text: `Something went wrong: ${json.error ?? "try again"}` }],
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "agent", blocks: [{ type: "text", text: "Network error — try again." }] },
      ]);
    } finally {
      setThinking(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-screen flex-col">
      {/* Thread */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          {empty ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-lg font-bold text-white">
                A
              </span>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight">
                {greetingName}, what should we do with your ads today?
              </h1>
              <p className="mt-2 max-w-md text-sm text-zinc-500">
                I can audit your account, launch campaigns, project budgets, and find
                wasted spend. Nothing changes without your approval.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:border-zinc-400"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl bg-zinc-200/70 px-4 py-2.5 text-sm text-zinc-800">
                      {m.blocks[0]?.type === "text" ? m.blocks[0].text : ""}
                    </div>
                  </div>
                ) : (
                  <div key={i}>
                    <div className="flex items-center gap-2.5">
                      <AgentAvatar />
                      <span className="text-sm font-semibold">AdPilot agent</span>
                    </div>
                    <div className="mt-3 pl-[38px]">
                      <Blocks blocks={m.blocks} />
                    </div>
                  </div>
                ),
              )}
              {thinking && (
                <div>
                  <div className="flex items-center gap-2.5">
                    <AgentAvatar />
                    <span className="text-sm font-semibold">AdPilot agent</span>
                  </div>
                  <div className="mt-3 flex gap-1.5 pl-[38px]">
                    {[0, 150, 300].map((d) => (
                      <span
                        key={d}
                        className="h-2 w-2 animate-bounce rounded-full bg-zinc-300"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-zinc-200 bg-[#FAFAF9]/90 backdrop-blur">
        <form
          className="mx-auto flex w-full max-w-3xl items-center gap-2 px-6 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AdPilot anything about your ads…"
            className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || thinking}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-zinc-900 text-white transition hover:bg-zinc-700 disabled:opacity-30"
            aria-label="Send"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
              <path
                d="M3 8h10m0 0L9 4m4 4l-4 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
