import "server-only";
import crypto from "node:crypto";
import type { MetaAdsClient } from "@adpilot/meta-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { metaClientForConnection } from "@/lib/meta";
import { devMode } from "@/lib/dev";
import { MOCK_ACCOUNTS, createMockMetaClient } from "@/lib/mock-data";

export const DEV_MCP_KEY = "adp_dev_mcp_key";

export interface McpContext {
  workspaceId: string;
  accounts: { rowId: string; accountId: string; name: string; currency: string }[];
  meta: MetaAdsClient;
}

export function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function generateKey(): string {
  return `adp_${crypto.randomBytes(24).toString("hex")}`;
}

/** Resolve an Authorization: Bearer key to a workspace + Meta client. */
export async function resolveMcpKey(authHeader: string | null): Promise<McpContext | null> {
  const key = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!key) return null;

  if (devMode()) {
    if (key !== DEV_MCP_KEY) return null; // dev mode never hits the DB
    return {
      workspaceId: "dev",
      accounts: MOCK_ACCOUNTS.map((a) => ({
        rowId: a.id,
        accountId: a.account_id,
        name: a.name,
        currency: a.currency,
      })),
      meta: createMockMetaClient(),
    };
  }

  const admin = createAdminClient();
  const { data: keyRow } = await admin
    .from("mcp_keys")
    .select("id, workspace_id")
    .eq("key_hash", hashKey(key))
    .maybeSingle();
  if (!keyRow) return null;

  // Fire-and-forget usage timestamp.
  void admin
    .from("mcp_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => {});

  const { data: accounts } = await admin
    .from("ad_accounts")
    .select("id, account_id, name, currency, connection_id")
    .eq("workspace_id", keyRow.workspace_id)
    .order("created_at");
  if (!accounts?.length) return null;

  const meta = await metaClientForConnection(
    accounts[0]!.connection_id,
    keyRow.workspace_id,
  );
  return {
    workspaceId: keyRow.workspace_id,
    accounts: accounts.map((a) => ({
      rowId: a.id,
      accountId: a.account_id,
      name: a.name,
      currency: a.currency,
    })),
    meta,
  };
}
