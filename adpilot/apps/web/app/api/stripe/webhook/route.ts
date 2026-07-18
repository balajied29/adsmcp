import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe webhook — keeps the subscriptions table in sync.
 * Register in Stripe: {APP_URL}/api/stripe/webhook, events:
 *   checkout.session.completed, customer.subscription.updated,
 *   customer.subscription.deleted
 * Signature verified manually (HMAC-SHA256 over "t.payload") — no SDK.
 */

function verifySignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=") as [string, string]),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  // Reject stale events (>5 min) to blunt replay.
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${payload}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 501 });
  }

  const payload = await request.text(); // raw body — required for the signature
  if (!verifySignature(payload, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(payload) as {
    type: string;
    data: { object: Record<string, unknown> };
  };
  const obj = event.data.object;
  const admin = createAdminClient();

  if (event.type === "checkout.session.completed") {
    const workspaceId = obj.client_reference_id as string | null;
    if (workspaceId) {
      await admin.from("subscriptions").upsert({
        workspace_id: workspaceId,
        stripe_customer_id: String(obj.customer ?? ""),
        stripe_subscription_id: obj.subscription ? String(obj.subscription) : null,
        status: "active",
        updated_at: new Date().toISOString(),
      });
    }
  } else if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subId = String(obj.id ?? "");
    const status =
      event.type === "customer.subscription.deleted" ? "canceled" : String(obj.status ?? "");
    const periodEnd = obj.current_period_end
      ? new Date(Number(obj.current_period_end) * 1000).toISOString()
      : null;
    await admin
      .from("subscriptions")
      .update({ status, current_period_end: periodEnd, updated_at: new Date().toISOString() })
      .eq("stripe_subscription_id", subId);
  }

  return NextResponse.json({ received: true });
}
