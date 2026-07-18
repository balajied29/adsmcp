"use client";

import { useMemo, useState } from "react";

/**
 * Projection model (v1, deliberately simple and shown to the user as such):
 * - Baseline CPA and ROAS come from the account's own last 30 days.
 * - Scaling above the current daily spend applies diminishing returns:
 *   efficiency = (newBudget / currentDaily) ^ -0.15 — i.e. doubling budget
 *   costs ~10% efficiency, 4x costs ~19%. Scaling down assumes baseline
 *   efficiency.
 * - A ±20% band expresses that this is an estimate, not a promise.
 */
export function ProjectionsClient({
  currency,
  baseline,
}: {
  currency: string;
  baseline: { days: number; spend: number; conversions: number; revenue: number };
}) {
  const currentDaily = baseline.spend / baseline.days;
  const baselineCpa = baseline.conversions > 0 ? baseline.spend / baseline.conversions : null;
  const baselineRoas = baseline.spend > 0 ? baseline.revenue / baseline.spend : 0;

  const [daily, setDaily] = useState(Math.max(1, Math.round(currentDaily)));

  const projection = useMemo(() => {
    const scale = currentDaily > 0 ? daily / currentDaily : 1;
    const efficiency = scale > 1 ? Math.pow(scale, -0.15) : 1;
    const monthlySpend = daily * 30;

    const conversions = baselineCpa
      ? (monthlySpend / baselineCpa) * efficiency
      : null;
    const revenue = baselineRoas > 0 ? monthlySpend * baselineRoas * efficiency : null;
    const roas = baselineRoas > 0 ? baselineRoas * efficiency : null;
    const cpa = baselineCpa ? baselineCpa / efficiency : null;

    return { monthlySpend, conversions, revenue, roas, cpa, efficiency };
  }, [daily, currentDaily, baselineCpa, baselineRoas]);

  const money = (n: number) =>
    `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${currency}`;
  const band = (n: number, f: (x: number) => string) => `${f(n * 0.8)} – ${f(n * 1.2)}`;

  return (
    <div className="mt-6 space-y-6">
      {/* Baseline */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Your last 30 days
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-zinc-500">Spend</p>
            <p className="mt-0.5 text-lg font-semibold">{money(baseline.spend)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Conversions</p>
            <p className="mt-0.5 text-lg font-semibold">
              {baseline.conversions.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-zinc-500">CPA</p>
            <p className="mt-0.5 text-lg font-semibold">
              {baselineCpa ? money(baselineCpa) : "—"}
            </p>
          </div>
          <div>
            <p className="text-zinc-500">ROAS</p>
            <p className="mt-0.5 text-lg font-semibold">
              {baselineRoas > 0 ? `${baselineRoas.toFixed(2)}x` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Slider */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">If you spent…</h2>
          <span className="text-2xl font-semibold text-blue-600">
            {money(daily)}
            <span className="text-sm font-normal text-zinc-400">/day</span>
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={Math.max(Math.round(currentDaily * 5), 100)}
          value={daily}
          onChange={(e) => setDaily(Number(e.target.value))}
          className="mt-4 w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-zinc-400">
          <span>1/day</span>
          <span>current: {money(Math.round(currentDaily))}/day</span>
          <span>{money(Math.max(Math.round(currentDaily * 5), 100))}/day</span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div className="rounded-xl bg-zinc-50 p-4">
            <p className="text-zinc-500">Monthly spend</p>
            <p className="mt-1 font-semibold">{money(projection.monthlySpend)}</p>
          </div>
          <div className="rounded-xl bg-zinc-50 p-4">
            <p className="text-zinc-500">Est. conversions /mo</p>
            <p className="mt-1 font-semibold">
              {projection.conversions
                ? band(projection.conversions, (x) => Math.round(x).toLocaleString())
                : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-zinc-50 p-4">
            <p className="text-zinc-500">Est. revenue /mo</p>
            <p className="mt-1 font-semibold">
              {projection.revenue ? band(projection.revenue, money) : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-zinc-50 p-4">
            <p className="text-zinc-500">Est. ROAS</p>
            <p className="mt-1 font-semibold">
              {projection.roas ? `${(projection.roas * 0.8).toFixed(1)}–${(projection.roas * 1.2).toFixed(1)}x` : "—"}
            </p>
          </div>
        </div>

        {projection.efficiency < 1 && (
          <p className="mt-4 text-xs leading-5 text-zinc-500">
            Scaling {Math.round((daily / currentDaily) * 10) / 10}x above your current
            spend assumes ~{Math.round((1 - projection.efficiency) * 100)}% efficiency
            loss (audiences saturate as budgets grow). Ranges are ±20% around the model.
          </p>
        )}
      </div>

      <p className="text-xs leading-5 text-zinc-400">
        Method: baseline CPA ({baselineCpa ? money(baselineCpa) : "n/a"}) and ROAS (
        {baselineRoas > 0 ? `${baselineRoas.toFixed(2)}x` : "n/a"}) from your last 30
        days, with a power-law diminishing-returns adjustment when scaling above current
        spend. Real results depend on creative, seasonality, and auction conditions.
      </p>
    </div>
  );
}
