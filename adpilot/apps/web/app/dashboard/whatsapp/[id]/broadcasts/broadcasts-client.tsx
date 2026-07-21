"use client";

import { useState } from "react";

interface Template {
  id: string;
  name: string;
  status: string;
}
interface Audience {
  id: string;
  name: string;
  member_count: number;
}
interface Broadcast {
  id: string;
  name: string;
  status: string;
  template_name: string;
  recipient_count: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-500",
  approved: "bg-blue-50 text-blue-700",
  sending: "bg-amber-50 text-amber-700",
  sent: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-700",
  cancelled: "bg-zinc-100 text-zinc-400",
  failed: "bg-red-50 text-red-700",
};

export function BroadcastsClient({
  connectionRowId,
  templates,
  audiences,
  initialBroadcasts,
}: {
  connectionRowId: string;
  templates: Template[];
  audiences: Audience[];
  initialBroadcasts: Broadcast[];
}) {
  const [broadcasts, setBroadcasts] = useState(initialBroadcasts);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [audienceId, setAudienceId] = useState(audiences[0]?.id ?? "");
  const [var1, setVar1] = useState("{{contact.display_name}}");
  const [var2, setVar2] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  async function createDraft() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/whatsapp/${connectionRowId}/broadcasts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          templateId,
          audienceId,
          variableSpec: { ...(var1 && { "1": var1 }), ...(var2 && { "2": var2 }) },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      const templateName = templates.find((t) => t.id === templateId)?.name ?? "—";
      const audienceMembers = audiences.find((a) => a.id === audienceId)?.member_count ?? 0;
      setBroadcasts((b) => [
        {
          id: json.id,
          name,
          status: "draft",
          template_name: templateName,
          recipient_count: audienceMembers,
          sent_count: 0,
          delivered_count: 0,
          failed_count: 0,
          created_at: new Date().toISOString(),
        },
        ...b,
      ]);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  async function approve(id: string) {
    setApprovingId(id);
    setResult(null);
    try {
      const res = await fetch(`/api/whatsapp/${connectionRowId}/broadcasts/${id}/approve`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok) {
        setBroadcasts((b) =>
          b.map((x) =>
            x.id === id ? { ...x, status: "sending", recipient_count: json.recipientCount } : x,
          ),
        );
        setResult({ id, ok: true, text: `Queued ${json.recipientCount} recipients — dispatcher will send them.` });
      } else {
        setResult({ id, ok: false, text: json.error });
      }
    } finally {
      setApprovingId(null);
    }
  }

  async function cancel(id: string) {
    const res = await fetch(`/api/whatsapp/${connectionRowId}/broadcasts/${id}/cancel`, {
      method: "POST",
    });
    if (res.ok) setBroadcasts((b) => b.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)));
  }

  const noApprovedTemplates = templates.length === 0;
  const noAudiences = audiences.length === 0;

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="font-semibold">New broadcast (draft)</p>
        {(noApprovedTemplates || noAudiences) && (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            {noApprovedTemplates && "No approved templates yet. "}
            {noAudiences && "No audiences yet — build one on the Contacts & audiences page."}
          </p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Broadcast name"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Select template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={audienceId}
            onChange={(e) => setAudienceId(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Select audience…</option>
            {audiences.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.member_count})
              </option>
            ))}
          </select>
          <input
            value={var1}
            onChange={(e) => setVar1(e.target.value)}
            placeholder="Variable {{1}} — try {{contact.display_name}}"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={var2}
            onChange={(e) => setVar2(e.target.value)}
            placeholder="Variable {{2}} (optional), e.g. a link"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void createDraft()}
            disabled={creating || !name || !templateId || !audienceId}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create draft"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>

      <ul className="space-y-2">
        {broadcasts.map((b) => (
          <li key={b.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{b.name}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {b.template_name} · {b.recipient_count} recipients ·{" "}
                  {new Date(b.created_at).toLocaleString()}
                </p>
              </div>
              <span
                className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${STATUS_STYLE[b.status] ?? "bg-zinc-100 text-zinc-500"}`}
              >
                {b.status}
              </span>
            </div>

            {(b.status === "sending" || b.status === "sent" || b.status === "paused") && (
              <div className="mt-3 flex gap-4 text-xs text-zinc-500">
                <span>Sent: {b.sent_count}</span>
                <span>Delivered: {b.delivered_count}</span>
                <span className={b.failed_count > 0 ? "text-red-600" : ""}>
                  Failed: {b.failed_count}
                </span>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              {b.status === "draft" && (
                <button
                  type="button"
                  onClick={() => void approve(b.id)}
                  disabled={approvingId === b.id}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {approvingId === b.id ? "Approving…" : "Approve & send"}
                </button>
              )}
              {["draft", "approved", "sending", "paused"].includes(b.status) && (
                <button
                  type="button"
                  onClick={() => void cancel(b.id)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 hover:border-red-300 hover:text-red-600"
                >
                  Cancel
                </button>
              )}
              {result?.id === b.id && (
                <span className={`text-xs ${result.ok ? "text-emerald-600" : "text-red-600"}`}>
                  {result.text}
                </span>
              )}
            </div>
          </li>
        ))}
        {broadcasts.length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            No broadcasts yet.
          </p>
        )}
      </ul>
    </div>
  );
}
