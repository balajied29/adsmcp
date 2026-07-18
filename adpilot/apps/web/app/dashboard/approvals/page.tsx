import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { devMode } from "@/lib/dev";
import { MOCK_RECOMMENDATIONS } from "@/lib/mock-data";
import { ApprovalsList, type QueueItem } from "./approvals-list";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  let items: QueueItem[];

  if (devMode()) {
    items = MOCK_RECOMMENDATIONS as QueueItem[];
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data } = await supabase
      .from("recommendations")
      .select("id, kind, title, rationale, estimated_impact, action, created_at, ad_accounts ( id, name )")
      .eq("status", "proposed")
      .order("created_at", { ascending: false });
    items = (data ?? []) as unknown as QueueItem[];
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-8">
      <h1 className="text-xl font-semibold">Approvals</h1>
      <p className="mt-0.5 text-sm text-zinc-500">
        Recommendations from the daily audit. Nothing executes until you approve it —
        and every execution passes the guardrails.
      </p>

      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
          <p className="font-medium text-zinc-700">Queue&apos;s clear.</p>
          <p className="mt-1">
            The audit worker files new recommendations here after each daily run.
          </p>
        </div>
      ) : (
        <ApprovalsList items={items} />
      )}
    </main>
  );
}
