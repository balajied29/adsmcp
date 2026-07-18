import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountContext } from "@/lib/account";
import { ProjectionsClient } from "./projections-client";

export const dynamic = "force-dynamic";

const PURCHASE_KEYS = [
  "omni_purchase",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "lead",
  "onsite_conversion.lead_grouped",
];

export default async function ProjectionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAccountContext(id);
  if (!ctx) redirect("/login");
  const { account, meta } = ctx;

  let baseline: {
    days: number;
    spend: number;
    conversions: number;
    revenue: number;
  } | null = null;
  let loadError: string | null = null;

  try {
    const rows = await meta.getInsights(account.account_id, {
      level: "account",
      datePreset: "last_30d",
    });
    const row = rows[0];
    if (row) {
      const spend = row.spend ?? 0;
      // First matching conversion key wins (omni_purchase already includes pixel purchases)
      let conversions = 0;
      for (const key of PURCHASE_KEYS) {
        if (row.conversions?.[key]) {
          conversions = row.conversions[key];
          break;
        }
      }
      const revenue = row.roas ? row.roas * spend : 0;
      baseline = { days: 30, spend, conversions, revenue };
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load insights";
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <Link
        href={`/dashboard/accounts/${account.id}`}
        className="text-sm text-zinc-500 hover:text-zinc-800"
      >
        ← {account.name}
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Budget projections</h1>
      <p className="text-sm text-zinc-500">
        Modeled from this account&apos;s last 30 days of results — not a guarantee.
      </p>

      {loadError && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
      )}

      {!loadError &&
        (!baseline || baseline.spend === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            Not enough spend history in the last 30 days to project from. Run some
            campaigns first — projections need your own CPA and ROAS as a baseline.
          </p>
        ) : (
          <ProjectionsClient currency={account.currency} baseline={baseline} />
        ))}
    </main>
  );
}
