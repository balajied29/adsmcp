import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { devMode } from "@/lib/dev";
import { MOCK_WA_CONNECTIONS, MOCK_WA_INBOUND } from "@/lib/wa-mock-data";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let connectionName: string;
  let messages: typeof MOCK_WA_INBOUND;

  if (devMode()) {
    const c = MOCK_WA_CONNECTIONS.find((x) => x.id === id);
    if (!c) notFound();
    connectionName = c.verified_name;
    messages = MOCK_WA_INBOUND;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: connection } = await supabase
      .from("wa_connections")
      .select("id, verified_name")
      .eq("id", id)
      .single();
    if (!connection) notFound();
    connectionName = connection.verified_name ?? connection.id;

    const { data } = await supabase
      .from("wa_inbound")
      .select("id, contact_phone_e164, body, referral, received_at")
      .eq("wa_connection_id", id)
      .order("received_at", { ascending: false })
      .limit(100);
    messages = (data ?? []).map((m) => ({ ...m, contact_name: null }));
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-8">
      <Link href="/dashboard/whatsapp" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← WhatsApp
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Inbox — {connectionName}</h1>
      <p className="text-sm text-zinc-500">
        Inbound messages. Ad-originated ones (Click-to-WhatsApp) show which ad started
        the conversation.
      </p>

      <ul className="mt-6 space-y-3">
        {messages.map((m) => (
          <li key={m.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-mono">
                +{m.contact_phone_e164} {m.contact_name ? `· ${m.contact_name}` : ""}
              </span>
              <span>{new Date(m.received_at).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm text-zinc-800">{m.body}</p>
            {m.referral && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                from ad: {(m.referral as { headline?: string }).headline ?? "Click-to-WhatsApp"}
              </p>
            )}
          </li>
        ))}
        {messages.length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            No inbound messages yet.
          </p>
        )}
      </ul>
    </main>
  );
}
