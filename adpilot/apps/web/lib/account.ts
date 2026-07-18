import "server-only";
import type { MetaAdsClient } from "@adpilot/meta-client";
import { createClient } from "@/lib/supabase/server";
import { metaClientForConnection } from "@/lib/meta";
import { devMode, DEV_USER } from "@/lib/dev";
import { MOCK_ACCOUNTS, createMockMetaClient } from "@/lib/mock-data";

export interface AccountContext {
  userId: string;
  account: {
    id: string;
    account_id: string;
    name: string;
    currency: string;
    connection_id: string;
  };
  meta: MetaAdsClient;
}

/**
 * Resolve the signed-in user + one of their ad accounts + a ready Meta client.
 * Returns null when unauthenticated or the account isn't theirs (RLS enforces
 * ownership on the select).
 */
export async function getAccountContext(accountRowId: string): Promise<AccountContext | null> {
  if (devMode()) {
    const account = MOCK_ACCOUNTS.find((a) => a.id === accountRowId);
    if (!account) return null;
    return { userId: DEV_USER.id, account, meta: createMockMetaClient() };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: account } = await supabase
    .from("ad_accounts")
    .select("id, account_id, name, currency, connection_id")
    .eq("id", accountRowId)
    .single();
  if (!account) return null;

  const meta = await metaClientForConnection(account.connection_id, user.id);
  return { userId: user.id, account, meta };
}
