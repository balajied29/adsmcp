import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { exchangeEmbeddedSignupCode, WaAdsClient } from "@adpilot/wa-client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/crypto";
import { devMode } from "@/lib/dev";

const bodySchema = z.object({
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
});

/**
 * POST — completes WhatsApp Embedded Signup. The client-side flow (see
 * whatsapp-connect-button.tsx) drives Meta's JS SDK popup and hands us the
 * OAuth `code` plus the waba_id/phone_number_id captured from the signup
 * session-info postMessage event. We exchange the code for a long-lived
 * business-integration token, fetch phone number details, and store the
 * connection encrypted.
 *
 * NOTE: the embedded-signup JS flow requires a live Meta app configured with
 * the WhatsApp product and a signup config — it has not been exercised
 * against real Meta infrastructure in this build. Verify end-to-end before
 * relying on it in production; the code exchange and storage logic below
 * follow Meta's documented shape.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { code, wabaId, phoneNumberId } = parsed.data;

  if (devMode()) {
    // Dev mode's connection list is static mock data — nothing to persist.
    return NextResponse.json({ ok: true, connectionId: "dev-wa-conn-1" });
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: "WhatsApp connect isn't configured (missing META_APP_ID/META_APP_SECRET)." },
      { status: 501 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const exchange = await exchangeEmbeddedSignupCode(appId, appSecret, code);
    const wa = new WaAdsClient(exchange.accessToken, phoneNumberId);
    const phoneInfo = await wa.getPhoneNumber();

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("wa_connections")
      .upsert(
        {
          workspace_id: user.id,
          waba_id: wabaId,
          phone_number_id: phoneNumberId,
          display_phone_number: phoneInfo.displayPhoneNumber,
          verified_name: phoneInfo.verifiedName,
          quality_rating: phoneInfo.qualityRating ?? null,
          encrypted_token: encryptToken(exchange.accessToken),
        },
        { onConflict: "workspace_id,phone_number_id" },
      )
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to store connection");

    return NextResponse.json({ ok: true, connectionId: data.id });
  } catch (err) {
    console.error("WhatsApp connect failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Connect failed" },
      { status: 502 },
    );
  }
}

