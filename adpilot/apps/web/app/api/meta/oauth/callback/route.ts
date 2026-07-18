import { NextResponse, type NextRequest } from "next/server";
import {
  MetaAdsClient,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
} from "@adpilot/meta-client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/crypto";

/**
 * OAuth callback: verifies state, exchanges code -> short-lived -> long-lived
 * token, discovers the Meta user + their ad accounts, and stores the
 * connection with the token encrypted at rest.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  const fail = (reason: string) =>
    NextResponse.redirect(`${appUrl}/dashboard?connect_error=${encodeURIComponent(reason)}`);

  // User must be signed in — the connection is stored under their workspace.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${appUrl}/login`);

  // CSRF check
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("meta_oauth_state")?.value;
  if (!state || !expectedState || state !== expectedState) {
    return fail("Invalid OAuth state — please retry the connection.");
  }

  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");
  if (oauthError) return fail(oauthError);

  const code = searchParams.get("code");
  if (!code) return fail("Meta did not return an authorization code.");

  try {
    // code -> short-lived -> long-lived (~60 days)
    const redirectUri = `${appUrl}/api/meta/oauth/callback`;
    const shortLived = await exchangeCodeForToken(
      process.env.META_APP_ID!,
      process.env.META_APP_SECRET!,
      redirectUri,
      code,
    );
    const longLived = await exchangeForLongLivedToken(
      process.env.META_APP_ID!,
      process.env.META_APP_SECRET!,
      shortLived.accessToken,
    );

    const meta = new MetaAdsClient(longLived.accessToken);
    const fbUser = await meta.graph.get<{ id: string; name?: string }>("me", {
      fields: "id,name",
    });
    const adAccounts = await meta.listAdAccounts();

    const admin = createAdminClient();

    const expiresAt = longLived.expiresInSeconds
      ? new Date(Date.now() + longLived.expiresInSeconds * 1000).toISOString()
      : null;

    const { data: connection, error: connError } = await admin
      .from("meta_connections")
      .upsert(
        {
          workspace_id: user.id,
          fb_user_id: fbUser.id,
          fb_user_name: fbUser.name ?? null,
          encrypted_token: encryptToken(longLived.accessToken),
          token_expires_at: expiresAt,
          scopes: ["ads_read", "ads_management", "business_management"],
        },
        { onConflict: "workspace_id,fb_user_id" },
      )
      .select("id")
      .single();
    if (connError || !connection) {
      throw new Error(connError?.message ?? "Failed to store connection");
    }

    if (adAccounts.length) {
      const { error: acctError } = await admin.from("ad_accounts").upsert(
        adAccounts.map((a) => ({
          workspace_id: user.id,
          connection_id: connection.id,
          account_id: a.id,
          name: a.name,
          currency: a.currency,
          status: a.status,
        })),
        { onConflict: "connection_id,account_id" },
      );
      if (acctError) throw new Error(acctError.message);
    }

    const response = NextResponse.redirect(`${appUrl}/dashboard?connected=1`);
    response.cookies.delete("meta_oauth_state");
    return response;
  } catch (err) {
    console.error("Meta OAuth callback failed:", err);
    return fail(err instanceof Error ? err.message : "Connection failed");
  }
}
