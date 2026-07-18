import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { devMode } from "@/lib/dev";

export const dynamic = "force-dynamic";

const FEATURES = [
  "Unlimited AI audits & chat",
  "Campaign launcher with audience curation",
  "Daily audit worker + email digests",
  "Approval queue with guarded execution",
  "Pixel & Conversions API tooling",
];

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string; canceled?: string; dev_checkout?: string }>;
}) {
  const params = await searchParams;

  let plan = "Beta — free";
  let status: string | null = null;
  let periodEnd: string | null = null;

  if (!devMode()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .maybeSingle();
    if (sub) {
      plan = sub.status === "active" || sub.status === "trialing" ? "Pro" : "Beta — free";
      status = sub.status;
      periodEnd = sub.current_period_end;
    }
  }

  const isPro = plan === "Pro";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-8">
      <h1 className="text-xl font-semibold">Billing</h1>
      <p className="mt-0.5 text-sm text-zinc-500">Your plan and subscription.</p>

      {params.dev_checkout && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Dev mode: checkout is skipped. With Stripe keys configured, this redirects to a
          real Stripe Checkout session.
        </p>
      )}
      {params.upgraded && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          Welcome to Pro — the subscription activates as soon as Stripe confirms payment.
        </p>
      )}
      {params.canceled && (
        <p className="mt-4 rounded-lg bg-zinc-100 p-3 text-sm text-zinc-600">
          Checkout canceled — no charge.
        </p>
      )}

      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Current plan
            </p>
            <p className="mt-1 text-2xl font-bold">{plan}</p>
            {status && (
              <p className="mt-0.5 text-xs text-zinc-500">
                Status: {status}
                {periodEnd && ` · renews ${new Date(periodEnd).toLocaleDateString()}`}
              </p>
            )}
          </div>
          {!isPro && (
            <form action="/api/stripe/checkout" method="post">
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
              >
                Upgrade to Pro — $99/mo
              </button>
            </form>
          )}
        </div>

        <ul className="mt-6 space-y-2 border-t border-zinc-100 pt-5 text-sm text-zinc-600">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] text-emerald-700">
                ✓
              </span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-xs text-zinc-400">
        During the private beta everything is free. Pro pricing kicks in at public
        launch; beta users keep a discount.
      </p>
    </main>
  );
}
