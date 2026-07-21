import "server-only";
import type { WaAdsClient } from "@adpilot/wa-client";
import { createClient } from "@/lib/supabase/server";
import { waClientForConnection } from "@/lib/wa";
import { devMode, DEV_USER } from "@/lib/dev";
import { MOCK_WA_CONNECTIONS } from "@/lib/wa-mock-data";
import { createMockWaClient } from "@adpilot/wa-client/mock";

export interface WaContext {
  userId: string;
  connection: {
    id: string;
    waba_id: string;
    phone_number_id: string;
    display_phone_number: string | null;
    verified_name: string | null;
  };
  wa: WaAdsClient;
}

/**
 * Resolve the signed-in user + a WhatsApp connection + a ready WaAdsClient.
 * Mirrors lib/account.ts's getAccountContext for the ads side.
 */
export async function getWaContext(connectionRowId: string): Promise<WaContext | null> {
  if (devMode()) {
    const connection = MOCK_WA_CONNECTIONS.find((c) => c.id === connectionRowId);
    if (!connection) return null;
    return { userId: DEV_USER.id, connection, wa: createMockWaClient() };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: connection } = await supabase
    .from("wa_connections")
    .select("id, waba_id, phone_number_id, display_phone_number, verified_name")
    .eq("id", connectionRowId)
    .single();
  if (!connection) return null;

  const wa = await waClientForConnection(connection.id, user.id);
  return { userId: user.id, connection, wa };
}
