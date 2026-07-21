import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { devMode } from "@/lib/dev";
import { MOCK_WA_CONNECTIONS, MOCK_WA_TEMPLATES } from "@/lib/wa-mock-data";
import { TemplatesClient } from "./templates-client";

export const dynamic = "force-dynamic";

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let connectionName: string;
  let templates: typeof MOCK_WA_TEMPLATES;

  if (devMode()) {
    const c = MOCK_WA_CONNECTIONS.find((x) => x.id === id);
    if (!c) notFound();
    connectionName = c.verified_name;
    templates = MOCK_WA_TEMPLATES;
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
      .from("wa_templates")
      .select("id, name, language, category, status, components")
      .eq("wa_connection_id", id)
      .order("name");
    templates = data ?? [];
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-8">
      <Link href="/dashboard/whatsapp" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← WhatsApp
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Templates — {connectionName}</h1>
      <p className="text-sm text-zinc-500">
        Only <strong>APPROVED</strong> templates can be used in broadcasts. Status updates
        arrive automatically from Meta.
      </p>

      <TemplatesClient connectionId={id} initialTemplates={templates} />
    </main>
  );
}
