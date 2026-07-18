import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountContext } from "@/lib/account";
import type { Campaign, InsightRow } from "@adpilot/meta-client";

export const dynamic = "force-dynamic";

function fmt(n: number | undefined, digits = 2): string {
  return n === undefined ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAccountContext(id);
  if (!ctx) redirect("/login");
  const { account, meta } = ctx;

  let campaigns: Campaign[] = [];
  let insights: InsightRow[] = [];
  let loadError: string | null = null;

  try {
    [campaigns, insights] = await Promise.all([
      meta.listCampaigns(account.account_id),
      meta.getInsights(account.account_id, { level: "campaign", datePreset: "last_7d" }),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load data from Meta";
  }

  const insightsByCampaign = new Map(insights.map((r) => [r.campaign, r]));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-6">
      <Link
        href="/dashboard/accounts"
        className="text-sm text-zinc-500 hover:text-zinc-800"
      >
        ← Ad accounts
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{account.name}</h1>
          <p className="text-sm text-zinc-500">
            {account.account_id} · {account.currency} · last 7 days
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href={`/dashboard/accounts/${account.id}/projections`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 hover:bg-zinc-50"
          >
            Projections
          </Link>
          <Link
            href={`/dashboard/accounts/${account.id}/pixels`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 hover:bg-zinc-50"
          >
            Pixels & CAPI
          </Link>
          <Link
            href={`/dashboard/accounts/${account.id}/launch`}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500"
          >
            Launch campaign
          </Link>
        </div>
      </div>

      {loadError && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
      )}

      {!loadError && campaigns.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          No campaigns in this account yet.
        </p>
      )}

      {campaigns.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Objective</th>
                <th className="px-4 py-3 text-right">Budget/day</th>
                <th className="px-4 py-3 text-right">Spend (7d)</th>
                <th className="px-4 py-3 text-right">Impressions</th>
                <th className="px-4 py-3 text-right">Clicks</th>
                <th className="px-4 py-3 text-right">CTR %</th>
                <th className="px-4 py-3 text-right">CPC</th>
                <th className="px-4 py-3 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const i = insightsByCampaign.get(c.name);
                return (
                  <tr key={c.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          c.status === "ACTIVE" ? "text-emerald-600" : "text-zinc-400"
                        }
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {c.objective?.replace("OUTCOME_", "") ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">{fmt(c.dailyBudget)}</td>
                    <td className="px-4 py-3 text-right">{fmt(i?.spend)}</td>
                    <td className="px-4 py-3 text-right">{fmt(i?.impressions, 0)}</td>
                    <td className="px-4 py-3 text-right">{fmt(i?.clicks, 0)}</td>
                    <td className="px-4 py-3 text-right">{fmt(i?.ctr)}</td>
                    <td className="px-4 py-3 text-right">{fmt(i?.cpc)}</td>
                    <td className="px-4 py-3 text-right">{fmt(i?.roas)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
