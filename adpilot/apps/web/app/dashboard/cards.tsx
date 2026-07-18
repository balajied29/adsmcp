"use client";

import { useState } from "react";
import Link from "next/link";
import type { AuditBlock, CampaignBlock } from "./chat-types";

/** Render **bold** spans inside agent text. */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold text-zinc-900">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const filled = (score / 100) * c;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative h-16 w-16 flex-none">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e4e4e7" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
        {score}
      </span>
    </div>
  );
}

const sectionLabel = "text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400";

type ActionState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; message?: string }
  | { phase: "noted" }
  | { phase: "failed"; message: string };

export function AuditCard({ block }: { block: AuditBlock }) {
  const [states, setStates] = useState<Record<number, ActionState>>({});

  const setState = (i: number, s: ActionState) =>
    setStates((prev) => ({ ...prev, [i]: s }));

  async function approve(i: number) {
    const a = block.actions[i];
    if (!a) return;

    // Manual task (no executable payload): just acknowledge.
    if (!a.action || !block.accountRowId) {
      setState(i, { phase: "noted" });
      return;
    }

    setState(i, { phase: "running" });
    try {
      const res = await fetch(`/api/accounts/${block.accountRowId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: a.title, action: a.action }),
      });
      const json = await res.json();
      if (res.ok) {
        setState(i, { phase: "done", message: json.message });
      } else {
        setState(i, { phase: "failed", message: json.error ?? "Execution failed" });
      }
    } catch {
      setState(i, { phase: "failed", message: "Network error — try again." });
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      {/* Score + fix/strong */}
      <div className="grid gap-6 border-b border-zinc-100 p-5 sm:grid-cols-[auto_1fr_1fr]">
        <ScoreRing score={block.score} />
        <div>
          <p className={sectionLabel}>Fix</p>
          <ul className="mt-2 space-y-1.5 text-[13px] text-zinc-700">
            {block.fix.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-zinc-900" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="sm:border-l sm:border-zinc-100 sm:pl-6">
          <p className={sectionLabel}>Strong</p>
          <ul className="mt-2 space-y-1.5 text-[13px] text-zinc-500">
            {block.strong.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-emerald-500" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Summary */}
      <p className="border-b border-zinc-100 p-5 text-sm leading-6 text-zinc-600">
        <RichText text={block.summary} />
      </p>

      {/* Biggest problem */}
      <div className="border-b border-zinc-100 p-5">
        <p className={sectionLabel}>The biggest problem</p>
        {block.biggestProblem.map((p, i) => (
          <p key={i} className="mt-2 text-sm leading-6 text-zinc-600">
            <RichText text={p} />
          </p>
        ))}
      </div>

      {/* Actions */}
      <div className="p-5">
        <p className={sectionLabel}>What I&apos;d do</p>
        <ol className="mt-3 space-y-4">
          {block.actions.map((a, i) => {
            const s = states[i] ?? { phase: "idle" };
            const executable = Boolean(a.action && block.accountRowId);
            return (
              <li key={i} className="flex items-start gap-4">
                <span className="mt-0.5 w-4 flex-none text-sm font-medium text-zinc-300">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900">
                    {a.title}
                    {!executable && (
                      <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                        manual
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-5 text-zinc-500">{a.detail}</p>
                  {s.phase === "done" && s.message && (
                    <p className="mt-1 text-xs text-emerald-600">{s.message}</p>
                  )}
                  {s.phase === "failed" && (
                    <p className="mt-1 text-xs text-red-600">{s.message}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void approve(i)}
                  disabled={s.phase === "running" || s.phase === "done" || s.phase === "noted"}
                  className={`flex-none rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    s.phase === "done" || s.phase === "noted"
                      ? "bg-emerald-50 text-emerald-700"
                      : s.phase === "failed"
                        ? "border border-red-300 text-red-600 hover:bg-red-50"
                        : s.phase === "running"
                          ? "bg-zinc-200 text-zinc-500"
                          : "bg-zinc-900 text-white hover:bg-zinc-700"
                  }`}
                >
                  {s.phase === "done"
                    ? "Executed ✓"
                    : s.phase === "noted"
                      ? "Noted ✓"
                      : s.phase === "running"
                        ? "Executing…"
                        : s.phase === "failed"
                          ? "Retry"
                          : executable
                            ? "Approve"
                            : "Mark done"}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export function CampaignCard({ block }: { block: CampaignBlock }) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-zinc-600">
        <RichText text={block.intro} />
      </p>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 p-5">
          <p className={sectionLabel}>Campaign setup</p>
          <h3 className="mt-1 text-base font-semibold">{block.title}</h3>
        </div>

        <div className="grid divide-y divide-zinc-100 border-b border-zinc-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {block.stats.map((s) => (
            <div key={s.label} className="p-5">
              <p className="text-xs text-zinc-400">{s.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{s.value}</p>
              <p className="mt-0.5 text-xs text-zinc-400">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="divide-y divide-zinc-100">
          {block.rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="text-zinc-400">{label}</span>
              <span className="font-semibold text-zinc-900">{value}</span>
            </div>
          ))}
        </div>

        {block.launchHref && (
          <div className="flex items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50/60 px-5 py-4">
            <p className="text-xs text-zinc-500">
              Review and launch — it&apos;s created paused, nothing spends yet.
            </p>
            <Link
              href={block.launchHref}
              className="flex-none rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700"
            >
              Open in launcher →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
