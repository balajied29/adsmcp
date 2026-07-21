import "server-only";
import { WaAdsClient } from "@adpilot/wa-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/crypto";

/**
 * Build a WaAdsClient for one of the workspace's WhatsApp connections.
 * Token decryption happens here and nowhere else (mirrors lib/meta.ts).
 */
export async function waClientForConnection(
  connectionId: string,
  workspaceId: string,
): Promise<WaAdsClient> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wa_connections")
    .select("encrypted_token, phone_number_id, workspace_id")
    .eq("id", connectionId)
    .single();

  if (error || !data) throw new Error("WhatsApp connection not found");
  if (data.workspace_id !== workspaceId) throw new Error("Connection not found");

  return new WaAdsClient(decryptToken(data.encrypted_token), data.phone_number_id);
}
