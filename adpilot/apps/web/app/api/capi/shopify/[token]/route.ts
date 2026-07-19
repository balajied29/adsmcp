import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { metaClientForConnection } from "@/lib/meta";
import { devMode, DEV_RELAY_TOKEN } from "@/lib/dev";
import { createMockMetaClient } from "@/lib/mock-data";

/**
 * Shopify -> Meta Conversions API relay.
 * Register in Shopify: Settings → Notifications → Webhooks → "Order creation",
 * URL: {APP_URL}/api/capi/shopify/{relay_token}
 * Maps the order to a Purchase event with value/currency, hashed email/phone,
 * and event_id = order id (deduplicates against the browser pixel).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const rawBody = await request.text();

  // --- Resolve the relay ---
  let pixelId: string;
  let meta;
  let secret: string | null = null;
  let relayId: string | null = null;

  if (devMode() && token === DEV_RELAY_TOKEN) {
    pixelId = "1053872649";
    meta = createMockMetaClient();
  } else {
    const admin = createAdminClient();
    const { data: relay } = await admin
      .from("capi_relays")
      .select("id, workspace_id, pixel_id, shopify_webhook_secret, ad_accounts ( connection_id )")
      .eq("relay_token", token)
      .maybeSingle();
    if (!relay) return NextResponse.json({ error: "Unknown relay" }, { status: 404 });

    secret = relay.shopify_webhook_secret;
    relayId = relay.id;
    pixelId = relay.pixel_id;
    const connectionId = (relay.ad_accounts as unknown as { connection_id: string })
      ?.connection_id;
    meta = await metaClientForConnection(connectionId, relay.workspace_id);
  }

  // --- Verify Shopify HMAC when a secret is configured ---
  if (secret) {
    const provided = request.headers.get("x-shopify-hmac-sha256") ?? "";
    const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
    const ok =
      provided.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    if (!ok) return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
  }

  // --- Map order -> Purchase event ---
  let order: Record<string, any>;
  try {
    order = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const value = Number(order.total_price ?? order.current_total_price ?? 0);
  const currency = String(order.currency ?? order.presentment_currency ?? "USD");
  const email = order.email ?? order.customer?.email ?? undefined;
  const phone = order.phone ?? order.customer?.phone ?? undefined;
  const eventId = String(order.id ?? crypto.randomUUID());
  const eventTime = order.created_at
    ? Math.floor(new Date(order.created_at).getTime() / 1000)
    : undefined;

  try {
    const result = await meta.launch.sendCapiEvent(pixelId, {
      eventName: "Purchase",
      eventId,
      eventTime,
      value,
      currency,
      email,
      phone,
      eventSourceUrl: order.order_status_url ?? undefined,
    });

    if (relayId) {
      const admin = createAdminClient();
      void admin
        .from("capi_relays")
        .update({ last_event_at: new Date().toISOString() })
        .eq("id", relayId)
        .then(() => {});
    }

    return NextResponse.json({ ok: true, eventsReceived: result.eventsReceived });
  } catch (err) {
    // 500 → Shopify retries with backoff, which is what we want on Meta hiccups.
    console.error("CAPI relay failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Relay failed" },
      { status: 500 },
    );
  }
}
