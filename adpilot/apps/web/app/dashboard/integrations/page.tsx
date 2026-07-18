import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { devMode } from "@/lib/dev";
import { IntegrationsUI } from "./integrations-ui";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  let metaConnected = false;

  if (devMode()) {
    metaConnected = true;
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
  }

  return <IntegrationsUI metaConnected={metaConnected} />;
}
