import "server-only";
import { MetaAdsClient } from "@adpilot/meta-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/crypto";

/**
 * Build a MetaAdsClient for one of the workspace's connections.
 * Token decryption happens here and nowhere else.
 */
export async function metaClientForConnection(
  connectionId: string,
  workspaceId: string,
): Promise<MetaAdsClient> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("meta_connections")
    .select("encrypted_token, workspace_id")
    .eq("id", connectionId)
    .single();

  if (error || !data) throw new Error("Meta connection not found");
  // Defense in depth: the admin client bypasses RLS, so re-check ownership.
  if (data.workspace_id !== workspaceId) throw new Error("Connection not found");

  return new MetaAdsClient(decryptToken(data.encrypted_token));
}
