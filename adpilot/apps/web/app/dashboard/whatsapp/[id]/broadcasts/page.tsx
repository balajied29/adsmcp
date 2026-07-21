import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { devMode } from "@/lib/dev";
import {
  MOCK_WA_AUDIENCE_ROWS,
  MOCK_WA_BROADCAST_ROWS,
  MOCK_WA_CONNECTIONS,
  MOCK_WA_TEMPLATES,
} from "@/lib/wa-mock-data";
import { BroadcastsClient } from "./broadcasts-client";

export const dynamic = "force-dynamic";

export default async function BroadcastsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let connectionName: string;
  let templates: { id: string; name: string; status: string }[];
  let audiences: { id: string; name: string; member_count: number }[];
  let broadcasts: typeof MOCK_WA_BROADCAST_ROWS;

  if (devMode()) {
    const c = MOCK_WA_CONNECTIONS.find((x) => x.id === id);
    if (!c) notFound();
    connectionName = c.verified_name;
    templates = MOCK_WA_TEMPLATES.filter((t) => t.status === "APPROVED");
    audiences = MOCK_WA_AUDIENCE_ROWS;
    broadcasts = MOCK_WA_BROADCAST_ROWS;
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

    const [{ data: t }, { data: a }, { data: b }] = await Promise.all([
      supabase
        .from("wa_templates")
        .select("id, name, status")
        .eq("wa_connection_id", id)
        .eq("status", "APPROVED"),
      supabase.from("wa_audiences").select("id, name"),
      supabase
        .from("wa_broadcasts")
        .select("id, name, status, recipient_count, sent_count, delivered_count, failed_count, created_at, wa_templates(name)")
        .eq("wa_connection_id", id)
        .order("created_at", { ascending: false }),
    ]);
    templates = t ?? [];
    audiences = (a ?? []).map((x) => ({ ...x, member_count: 0 }));
    broadcasts = (b ?? []).map((x) => ({
      ...x,
      template_name: (x.wa_templates as unknown as { name: string } | null)?.name ?? "—",
    }));
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-8">
      <Link href="/dashboard/whatsapp" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← WhatsApp
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Broadcasts — {connectionName}</h1>
      <p className="text-sm text-zinc-500">
        Draft, then approve. Approving is the guardrail gate — it checks the template is
        approved, excludes opt-outs, and dedupes recent sends before anything queues.
      </p>

      <BroadcastsClient
        connectionRowId={id}
        templates={templates}
        audiences={audiences}
        initialBroadcasts={broadcasts}
      />
    </main>
  );
}
