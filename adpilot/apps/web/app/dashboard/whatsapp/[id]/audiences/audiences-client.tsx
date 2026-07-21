"use client";

import { useState } from "react";

interface Contact {
  id: string;
  phone_e164: string;
  display_name: string | null;
  tags: string[];
  opt_in_source: string;
  opted_out: boolean;
}

interface Audience {
  id: string;
  name: string;
  member_count: number;
}

export function AudiencesClient({
  contacts: initialContacts,
  audiences: initialAudiences,
}: {
  contacts: Contact[];
  audiences: Audience[];
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [audiences, setAudiences] = useState(initialAudiences);
  const [tab, setTab] = useState<"contacts" | "audiences">("contacts");

  // Add contact form
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [tags, setTags] = useState("");
  const [source, setSource] = useState("manual");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // New audience form
  const [audienceName, setAudienceName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creatingAudience, setCreatingAudience] = useState(false);

  async function addContact() {
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/whatsapp/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.replace(/[^0-9]/g, ""),
          displayName: displayName || undefined,
          tags: tags ? tags.split(",").map((t) => t.trim()) : [],
          optInSource: source,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setContacts((c) => [
        {
          id: `local-${Date.now()}`,
          phone_e164: phone.replace(/[^0-9]/g, ""),
          display_name: displayName || null,
          tags: tags ? tags.split(",").map((t) => t.trim()) : [],
          opt_in_source: source,
          opted_out: false,
        },
        ...c,
      ]);
      setPhone("");
      setDisplayName("");
      setTags("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed");
    } finally {
      setAdding(false);
    }
  }

  async function createAudience() {
    if (!audienceName || selected.size === 0) return;
    setCreatingAudience(true);
    try {
      const res = await fetch("/api/whatsapp/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: audienceName, contactIds: [...selected] }),
      });
      const json = await res.json();
      if (res.ok) {
        setAudiences((a) => [
          { id: json.id, name: audienceName, member_count: json.memberCount ?? selected.size },
          ...a,
        ]);
        setAudienceName("");
        setSelected(new Set());
        setTab("audiences");
      }
    } finally {
      setCreatingAudience(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex gap-1 border-b border-zinc-200">
        {(["contacts", "audiences"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition ${
              tab === t ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-400"
            }`}
          >
            {t} {t === "contacts" ? `(${contacts.length})` : `(${audiences.length})`}
          </button>
        ))}
      </div>

      {tab === "contacts" && (
        <div className="mt-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-sm font-semibold">Add a contact</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="15551234567"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Name (optional)"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tags, comma-separated"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="manual">Manual — I have consent</option>
                <option value="csv_import">CSV import — consented list</option>
              </select>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void addContact()}
                disabled={adding || !/^\d{7,15}$/.test(phone.replace(/[^0-9]/g, ""))}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                {adding ? "Adding…" : "Add contact"}
              </button>
              {addError && <p className="text-sm text-red-600">{addError}</p>}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              Select contacts, then switch to Audiences to save a segment.
            </p>
            {selected.size > 0 && (
              <span className="text-xs font-medium text-zinc-700">{selected.size} selected</span>
            )}
          </div>

          <ul className="mt-2 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() =>
                    setSelected((s) => {
                      const next = new Set(s);
                      next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                      return next;
                    })
                  }
                />
                <span className="w-32 flex-none font-mono text-xs text-zinc-500">
                  +{c.phone_e164}
                </span>
                <span className="flex-1 truncate">{c.display_name ?? "—"}</span>
                <span className="flex-none text-xs text-zinc-400">{c.opt_in_source}</span>
                {c.opted_out ? (
                  <span className="flex-none rounded bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                    opted out
                  </span>
                ) : (
                  c.tags.map((t) => (
                    <span
                      key={t}
                      className="flex-none rounded bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600"
                    >
                      {t}
                    </span>
                  ))
                )}
              </li>
            ))}
          </ul>

          {selected.size > 0 && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
              <input
                value={audienceName}
                onChange={(e) => setAudienceName(e.target.value)}
                placeholder="Audience name, e.g. 'VIP customers'"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void createAudience()}
                disabled={creatingAudience || !audienceName}
                className="flex-none rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {creatingAudience ? "Saving…" : `Save audience (${selected.size})`}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "audiences" && (
        <ul className="mt-4 space-y-2">
          {audiences.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 text-sm"
            >
              <span className="font-medium">{a.name}</span>
              <span className="text-xs text-zinc-400">{a.member_count} contacts</span>
            </li>
          ))}
          {audiences.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
              No audiences yet — select contacts to build one.
            </p>
          )}
        </ul>
      )}
    </div>
  );
}
