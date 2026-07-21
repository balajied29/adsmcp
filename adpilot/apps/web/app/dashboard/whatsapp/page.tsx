import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { devMode } from "@/lib/dev";
import { MOCK_WA_CONNECTIONS } from "@/lib/wa-mock-data";
import { WhatsAppConnectButton } from "./connect-button";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  let connections: typeof MOCK_WA_CONNECTIONS;

  if (devMode()) {
    connections = MOCK_WA_CONNECTIONS;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data } = await supabase
      .from("wa_connections")
      .select("id, waba_id, phone_number_id, display_phone_number, verified_name, quality_rating, messaging_tier, created_at")
      .order("created_at");
    connections = data ?? [];
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">WhatsApp</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Connect a WhatsApp Business number to send templates, run broadcasts, and
            capture leads.
          </p>
        </div>
        <WhatsAppConnectButton
          metaAppId={process.env.NEXT_PUBLIC_META_APP_ID ?? null}
          signupConfigId={process.env.NEXT_PUBLIC_WA_SIGNUP_CONFIG_ID ?? null}
          devFallback={devMode()}
        />
      </header>

      {connections.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
          No WhatsApp number connected yet.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {connections.map((c) => (
            <li key={c.id} className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {c.verified_name} <span className="text-zinc-400">· {c.display_phone_number}</span>
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                        c.quality_rating === "GREEN"
                          ? "bg-emerald-50 text-emerald-700"
                          : c.quality_rating === "YELLOW"
                            ? "bg-amber-50 text-amber-700"
                            : c.quality_rating === "RED"
                              ? "bg-red-50 text-red-700"
                              : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      Quality: {c.quality_rating ?? "unknown"}
                    </span>
                    {c.messaging_tier && <span>· Tier: {c.messaging_tier}</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Link
                    href={`/dashboard/whatsapp/${c.id}/templates`}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 hover:bg-zinc-50"
                  >
                    Templates
                  </Link>
                  <Link
                    href={`/dashboard/whatsapp/${c.id}/audiences`}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 hover:bg-zinc-50"
                  >
                    Contacts &amp; audiences
                  </Link>
                  <Link
                    href={`/dashboard/whatsapp/${c.id}/inbox`}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 hover:bg-zinc-50"
                  >
                    Inbox
                  </Link>
                  <Link
                    href={`/dashboard/whatsapp/${c.id}/broadcasts`}
                    className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-500"
                  >
                    Broadcasts
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
