import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountContext } from "@/lib/account";
import type { Pixel } from "@adpilot/meta-client";
import { PixelTools } from "./pixel-tools";

export const dynamic = "force-dynamic";

export default async function PixelsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAccountContext(id);
  if (!ctx) redirect("/login");
  const { account, meta } = ctx;

  let pixels: Pixel[] = [];
  let loadError: string | null = null;
  try {
    pixels = await meta.launch.listPixels(account.account_id);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load pixels";
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <Link
        href={`/dashboard/accounts/${account.id}`}
        className="text-sm text-zinc-500 hover:text-zinc-800"
      >
        ← {account.name}
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Pixels & Conversions API</h1>
      <p className="text-sm text-zinc-500">
        Track sales so campaigns can optimize for conversions and projections have real
        data.
      </p>

      {loadError && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
      )}

      {!loadError && pixels.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-600">
          <p className="font-medium text-zinc-800">No pixel on this ad account yet.</p>
          <p className="mt-2 leading-6">
            Create one in{" "}
            <a
              href="https://business.facebook.com/events_manager2"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline"
            >
              Meta Events Manager
            </a>{" "}
            (Data sources → Connect data → Web), then come back here — AdPilot will pick
            it up, give you the install snippet, and let you verify events end to end.
          </p>
        </div>
      )}

      {pixels.length > 0 && <PixelTools accountRowId={account.id} pixels={pixels} />}
    </main>
  );
}
