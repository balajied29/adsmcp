import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { devMode } from "@/lib/dev";
import { IntegrationsUI } from "./integrations-ui";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  let metaConnected = false;
  let mcpKeys: { id: string; label: string; created_at: string; last_used_at: string | null }[] = [];

  if (devMode()) {
    metaConnected = true;
    mcpKeys = [
      {
        id: "dev-key",
        label: "Dev key",
        created_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        last_used_at: new Date(Date.now() - 3600_000).toISOString(),
      },
    ];
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { count } = await supabase
      .from("meta_connections")
      .select("id", { count: "exact", head: true });
    metaConnected = (count ?? 0) > 0;

    const { data: keys } = await supabase
      .from("mcp_keys")
      .select("id, label, created_at, last_used_at")
      .order("created_at");
    mcpKeys = keys ?? [];
  }

  return <IntegrationsUI metaConnected={metaConnected} mcpKeys={mcpKeys} />;
}
