"use client";

import { useState } from "react";

/** Toggle whether the daily audit worker covers this account. */
export function ManagedToggle({
  accountRowId,
  initial,
}: {
  accountRowId: string;
  initial: boolean;
}) {
  const [managed, setManaged] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); // the toggle lives inside the account card link
    e.stopPropagation();
    setBusy(true);
    try {
      const res = await fetch(`/api/accounts/${accountRowId}/managed`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managed: !managed }),
      });
      if (res.ok) setManaged(!managed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={managed ? "Daily audits on — click to disable" : "Daily audits off — click to enable"}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
        managed
          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
      } ${busy ? "opacity-50" : ""}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${managed ? "bg-emerald-500" : "bg-zinc-400"}`}
      />
      {managed ? "Auditing daily" : "Audits off"}
    </button>
  );
}
