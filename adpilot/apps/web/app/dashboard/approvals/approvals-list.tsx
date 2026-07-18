"use client";

import { useState } from "react";
import type { ExecutableAction } from "../chat-types";

export interface QueueItem {
  id: string;
  kind: string;
  title: string;
  rationale: string;
  estimated_impact: string | null;
  action: ExecutableAction | null;
  created_at: string;
  ad_accounts: { id: string; name: string } | null;
}

type ItemState =
  | { phase: "pending" }
  | { phase: "running" }
  | { phase: "executed"; message?: string }
  | { phase: "approved"; message?: string }
  | { phase: "dismissed" }
  | { phase: "failed"; message: string };

const KIND_LABEL: Record<string, string> = {
  pause_object: "Pause",
  resume_object: "Resume",
  budget_change: "Budget",
  creative_refresh: "Creative",
  observation: "FYI",
};

function timeAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ApprovalsList({ items }: { items: QueueItem[] }) {
  const [states, setStates] = useState<Record<string, ItemState>>({});

  const setState = (id: string, s: ItemState) =>
    setStates((prev) => ({ ...prev, [id]: s }));

  async function resolve(item: QueueItem, decision: "approve" | "dismiss") {
    if (!item.ad_accounts) return;
    setState(item.id, { phase: "running" });
    try {
      const res = await fetch("/api/recommendations/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendationId: item.id.startsWith("rec-") ? null : item.id, // mock rows aren't in the DB
          accountRowId: item.ad_accounts.id,
          title: item.title,
          decision,
          action: item.action,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setState(item.id, { phase: "failed", message: json.error ?? "Failed" });
        return;
      }
      if (json.status === "dismissed") setState(item.id, { phase: "dismissed" });
      else if (json.status === "approved")
        setState(item.id, { phase: "approved", message: json.message });
      else setState(item.id, { phase: "executed", message: json.message });
    } catch {
      setState(item.id, { phase: "failed", message: "Network error — try again." });
    }
  }

  const pending = items.filter(
    (i) => (states[i.id]?.phase ?? "pending") === "pending" || states[i.id]?.phase === "running" || states[i.id]?.phase === "failed",
  );
  const resolved = items.filter(
    (i) => !pending.includes(i),
  );

  const renderItem = (item: QueueItem) => {
    const s = states[item.id] ?? { phase: "pending" as const };
    const executable = Boolean(item.action);
    const settled = s.phase === "executed" || s.phase === "approved" || s.phase === "dismissed";

    return (
      <li
        key={item.id}
        className={`rounded-2xl border bg-white p-5 transition ${
          settled ? "border-zinc-100 opacity-60" : "border-zinc-200"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                {KIND_LABEL[item.kind] ?? item.kind}
              </span>
              <span className="text-xs text-zinc-400">
                {item.ad_accounts?.name} · {timeAgo(item.created_at)}
              </span>
              {!executable && (
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                  manual task
                </span>
              )}
            </div>
            <p className="mt-2 text-sm font-semibold text-zinc-900">{item.title}</p>
            <p className="mt-1 text-[13px] leading-5 text-zinc-500">{item.rationale}</p>
            {item.estimated_impact && (
              <p className="mt-1.5 text-xs font-medium text-emerald-600">
                {item.estimated_impact}
              </p>
            )}
            {s.phase === "executed" && s.message && (
              <p className="mt-2 text-xs text-emerald-600">✓ {s.message}</p>
            )}
            {s.phase === "approved" && s.message && (
              <p className="mt-2 text-xs text-emerald-600">✓ {s.message}</p>
            )}
            {s.phase === "failed" && (
              <p className="mt-2 text-xs text-red-600">{s.message}</p>
            )}
          </div>

          <div className="flex flex-none flex-col items-end gap-2">
            {s.phase === "executed" || s.phase === "approved" ? (
              <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                {s.phase === "executed" ? "Executed ✓" : "Accepted ✓"}
              </span>
            ) : s.phase === "dismissed" ? (
              <span className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-400">
                Dismissed
              </span>
            ) : (
              <>
                <button
                  type="button"
                  disabled={s.phase === "running"}
                  onClick={() => void resolve(item, "approve")}
                  className={`w-24 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    s.phase === "running"
                      ? "bg-zinc-200 text-zinc-500"
                      : s.phase === "failed"
                        ? "border border-red-300 text-red-600 hover:bg-red-50"
                        : "bg-zinc-900 text-white hover:bg-zinc-700"
                  }`}
                >
                  {s.phase === "running"
                    ? "Working…"
                    : s.phase === "failed"
                      ? "Retry"
                      : executable
                        ? "Approve"
                        : "Accept"}
                </button>
                <button
                  type="button"
                  disabled={s.phase === "running"}
                  onClick={() => void resolve(item, "dismiss")}
                  className="w-24 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-zinc-50"
                >
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="mt-6 space-y-6">
      <ul className="space-y-3">{pending.map(renderItem)}</ul>
      {resolved.length > 0 && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Resolved this session
          </p>
          <ul className="space-y-3">{resolved.map(renderItem)}</ul>
        </>
      )}
    </div>
  );
}
