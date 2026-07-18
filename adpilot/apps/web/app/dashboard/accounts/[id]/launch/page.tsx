import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountContext } from "@/lib/account";
import type { CustomAudience, Pixel } from "@adpilot/meta-client";
import { LaunchForm } from "./launch-form";

export const dynamic = "force-dynamic";

export default async function LaunchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAccountContext(id);
  if (!ctx) redirect("/login");
  const { account, meta } = ctx;

  let customAudiences: CustomAudience[] = [];
  let pixels: Pixel[] = [];
  let pages: { id: string; name: string }[] = [];
  let loadError: string | null = null;

  try {
    [customAudiences, pixels, pages] = await Promise.all([
      meta.launch.listCustomAudiences(account.account_id),
      meta.launch.listPixels(account.account_id),
      meta.launch.listPages(),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load account data";
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <Link
        href={`/dashboard/accounts/${account.id}`}
        className="text-sm text-zinc-500 hover:text-zinc-800"
      >
        ← {account.name}
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Launch a campaign</h1>
      <p className="text-sm text-zinc-500">
        {account.account_id} · budgets in {account.currency} · everything is created{" "}
        <strong>paused</strong> unless you say otherwise
      </p>

      {loadError && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
      )}

      <LaunchForm
        accountRowId={account.id}
        currency={account.currency}
        customAudiences={customAudiences}
        pixels={pixels}
        pages={pages}
      />
    </main>
  );
}
