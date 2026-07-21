"use client";

import { useState } from "react";

interface TemplateRow {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: unknown[];
}

const STATUS_STYLE: Record<string, string> = {
  APPROVED: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  REJECTED: "bg-red-50 text-red-700",
  PAUSED: "bg-zinc-100 text-zinc-500",
  DISABLED: "bg-zinc-100 text-zinc-500",
};

function bodyText(components: unknown[]): string {
  const body = components.find(
    (c): c is { type: string; text?: string } =>
      typeof c === "object" && c !== null && (c as any).type === "BODY",
  );
  return body?.text ?? "";
}

export function TemplatesClient({
  connectionId,
  initialTemplates,
}: {
  connectionId: string;
  initialTemplates: TemplateRow[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [syncing, setSyncing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [bodyTextInput, setBodyTextInput] = useState("");

  async function sync() {
    setSyncing(true);
    try {
      await fetch(`/api/whatsapp/${connectionId}/templates/sync`, { method: "POST" });
      window.location.reload();
    } finally {
      setSyncing(false);
    }
  }

  async function createTemplate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/whatsapp/${connectionId}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, bodyText: bodyTextInput }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setTemplates((t) => [
        ...t,
        { id: json.id, name, language: "en_US", category, status: json.status, components: [{ type: "BODY", text: bodyTextInput }] },
      ]);
      setShowNew(false);
      setName("");
      setBodyTextInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => void sync()}
          disabled={syncing}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync from Meta"}
        </button>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          New template
        </button>
      </div>

      {showNew && (
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Name (lowercase_underscore)
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="weekend_sale"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="MARKETING">Marketing</option>
                <option value="UTILITY">Utility</option>
                <option value="AUTHENTICATION">Authentication</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Body text — use {"{{1}}"}, {"{{2}}"}… for variables
            </label>
            <textarea
              value={bodyTextInput}
              onChange={(e) => setBodyTextInput(e.target.value)}
              rows={3}
              placeholder="Hi {{1}}! This weekend only — 20% off. Shop now: {{2}}"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void createTemplate()}
              disabled={creating || !name || !bodyTextInput}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {creating ? "Submitting…" : "Submit for approval"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {templates.map((t) => (
          <li key={t.id} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-medium">{t.name}</p>
                <p className="mt-1 text-xs text-zinc-500">{t.language} · {t.category}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[t.status] ?? "bg-zinc-100 text-zinc-500"}`}
              >
                {t.status}
              </span>
            </div>
            <p className="mt-2 rounded-lg bg-zinc-50 p-2.5 text-xs text-zinc-600">
              {bodyText(t.components) || "—"}
            </p>
          </li>
        ))}
        {templates.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
            No templates yet.
          </p>
        )}
      </ul>
    </div>
  );
}
