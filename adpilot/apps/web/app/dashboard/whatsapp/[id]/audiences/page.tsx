import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { devMode } from "@/lib/dev";
import { MOCK_WA_AUDIENCE_ROWS, MOCK_WA_CONNECTIONS, MOCK_WA_CONTACT_ROWS } from "@/lib/wa-mock-data";
import { AudiencesClient } from "./audiences-client";

export const dynamic = "force-dynamic";

interface ContactRow {
  id: string;
  phone_e164: string;
  display_name: string | null;
  tags: string[];
  opt_in_source: string;
  opted_out: boolean;
}

export default async function AudiencesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let connectionName: string;
  let contacts: ContactRow[];
  let audiences: typeof MOCK_WA_AUDIENCE_ROWS;

  if (devMode()) {
    const c = MOCK_WA_CONNECTIONS.find((x) => x.id === id);
    if (!c) notFound();
    connectionName = c.verified_name;
    contacts = MOCK_WA_CONTACT_ROWS;
    audiences = MOCK_WA_AUDIENCE_ROWS;
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

    const [{ data: contactRows }, { data: audienceRows }] = await Promise.all([
      supabase
        .from("wa_contacts")
        .select("id, phone_e164, display_name, tags, opt_in_source, opted_out")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("wa_audiences").select("id, name").order("created_at", { ascending: false }),
    ]);
    contacts = contactRows ?? [];
    audiences = (audienceRows ?? []).map((a) => ({ ...a, member_count: 0 }));
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-8">
      <Link href="/dashboard/whatsapp" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← WhatsApp
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Contacts &amp; audiences — {connectionName}</h1>
      <p className="text-sm text-zinc-500">
        Contacts are workspace-wide. Every marketing send requires a recorded opt-in
        source; opted-out contacts are always excluded.
      </p>

      <AudiencesClient contacts={contacts} audiences={audiences} />
    </main>
  );
}
