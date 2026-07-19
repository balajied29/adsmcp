import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { getAccountContext } from "@/lib/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { devMode, DEV_RELAY_TOKEN } from "@/lib/dev";

const createSchema = z.object({
  pixelId: z.string().min(1),
  shopifyWebhookSecret: z.string().optional(),
});

/** POST — create a Shopify CAPI relay for this account; returns the webhook URL. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAccountContext(id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  if (devMode()) {
    return NextResponse.json({
      id: "dev-relay",
      token: DEV_RELAY_TOKEN,
      pixelId: parsed.data.pixelId,
    });
  }

  const token = crypto.randomBytes(20).toString("hex");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("capi_relays")
    .insert({
      workspace_id: ctx.userId,
      ad_account_id: ctx.account.id,
      pixel_id: parsed.data.pixelId,
      relay_token: token,
      shopify_webhook_secret: parsed.data.shopifyWebhookSecret ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }
  return NextResponse.json({ id: data.id, token, pixelId: parsed.data.pixelId });
}

/** DELETE ?id= — remove a relay (RLS scopes to owner). */
export async function DELETE(request: NextRequest) {
  const relayId = request.nextUrl.searchParams.get("id");
  if (!relayId) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (devMode()) return NextResponse.json({ ok: true });

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("capi_relays").delete().eq("id", relayId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
