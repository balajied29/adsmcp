import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Single WhatsApp Cloud API webhook endpoint for every connected tenant.
 * Subscribe events: messages, message_template_status_update,
 * phone_number_quality_update. Routing key is phone_number_id (messages/
 * quality) or waba_id (templates) — an event for an unknown number/waba is
 * dropped and logged, never guessed at.
 */

// --- GET: Meta's subscription verification handshake ---
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WA_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// --- POST: event delivery ---
export async function POST(request: NextRequest) {
  const appSecret = process.env.META_APP_SECRET;
  const rawBody = await request.text();

  if (!appSecret) {
    console.error("WhatsApp webhook: META_APP_SECRET not configured, rejecting.");
    return NextResponse.json({ error: "Not configured" }, { status: 501 });
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Ack fast; process synchronously here since our handlers are simple
  // upserts, but keep this function short so we stay well under Meta's
  // response-timeout budget (a queue-based async path is the scale-up path).
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const field = change.field;
      const value = change.value ?? {};
      try {
        if (field === "messages") {
          await handleMessagesChange(admin, value);
        } else if (field === "message_template_status_update") {
          await handleTemplateStatus(admin, entry.id, value);
        } else if (field === "phone_number_quality_update") {
          await handleQualityUpdate(admin, value);
        }
      } catch (err) {
        // One bad change shouldn't fail the whole delivery — Meta retries
        // the entire payload on non-2xx, which would re-deliver good changes too.
        console.error(`WA webhook handler failed for field=${field}:`, err);
      }
    }
  }

  return NextResponse.json({ received: true });
}

function verifySignature(body: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function resolveConnectionByPhoneNumberId(admin: ReturnType<typeof createAdminClient>, phoneNumberId: string) {
  const { data } = await admin
    .from("wa_connections")
    .select("id, workspace_id")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  return data;
}

async function handleMessagesChange(admin: ReturnType<typeof createAdminClient>, value: any) {
  const phoneNumberId = value.metadata?.phone_number_id;
  if (!phoneNumberId) return;
  const connection = await resolveConnectionByPhoneNumberId(admin, phoneNumberId);
  if (!connection) {
    console.warn(`WA webhook: unknown phone_number_id ${phoneNumberId}, dropping event.`);
    return;
  }

  // Inbound messages
  for (const msg of value.messages ?? []) {
    await admin.from("wa_inbound").insert({
      workspace_id: connection.workspace_id,
      wa_connection_id: connection.id,
      contact_phone_e164: msg.from,
      wamid: msg.id,
      message_type: msg.type ?? "text",
      body: msg.text?.body ?? null,
      referral: msg.referral ?? null,
    });

    // Opt-out keywords auto-set opted_out on the contact.
    const bodyText = (msg.text?.body ?? "").trim().toUpperCase();
    if (["STOP", "UNSUBSCRIBE", "OPT OUT", "OPTOUT"].includes(bodyText)) {
      await admin
        .from("wa_contacts")
        .update({ opted_out: true, opted_out_at: new Date().toISOString() })
        .eq("workspace_id", connection.workspace_id)
        .eq("phone_e164", msg.from);
    } else {
      // Auto-capture: any inbound sender becomes a contact if not already known.
      await admin
        .from("wa_contacts")
        .upsert(
          {
            workspace_id: connection.workspace_id,
            phone_e164: msg.from,
            opt_in_source: "inbound_message",
          },
          { onConflict: "workspace_id,phone_e164", ignoreDuplicates: true },
        );
    }
  }

  // Outbound delivery status updates (sent/delivered/read/failed)
  for (const status of value.statuses ?? []) {
    const event = status.status as "sent" | "delivered" | "read" | "failed";
    await admin
      .from("wa_outbound_queue")
      .update({
        status: event,
        error_code: status.errors?.[0]?.code ? String(status.errors[0].code) : null,
      })
      .eq("wamid", status.id);

    await admin.from("wa_send_log").insert({
      workspace_id: connection.workspace_id,
      wamid: status.id,
      event,
      error_code: status.errors?.[0]?.code ? String(status.errors[0].code) : null,
      error_message: status.errors?.[0]?.title ?? null,
    });

    if (event === "delivered") {
      await incrementBroadcastCounter(admin, status.id, "delivered_count");
    } else if (event === "failed") {
      await incrementBroadcastCounter(admin, status.id, "failed_count");
    }
  }
}

async function incrementBroadcastCounter(
  admin: ReturnType<typeof createAdminClient>,
  wamid: string,
  column: "delivered_count" | "failed_count",
) {
  const { data: queueRow } = await admin
    .from("wa_outbound_queue")
    .select("broadcast_id")
    .eq("wamid", wamid)
    .maybeSingle();
  if (!queueRow) return;

  // Read-increment-write: webhook delivery volume is low enough that the
  // race window (two deliveries for the same wamid landing concurrently)
  // isn't worth a dedicated Postgres function for.
  const { data: broadcast } = await admin
    .from("wa_broadcasts")
    .select(column)
    .eq("id", queueRow.broadcast_id)
    .single();
  if (!broadcast) return;
  const current = (broadcast as Record<string, number | null>)[column] ?? 0;
  await admin
    .from("wa_broadcasts")
    .update({ [column]: current + 1 })
    .eq("id", queueRow.broadcast_id);
}

async function handleTemplateStatus(
  admin: ReturnType<typeof createAdminClient>,
  wabaId: string,
  value: any,
) {
  const { data: connection } = await admin
    .from("wa_connections")
    .select("id, workspace_id")
    .eq("waba_id", wabaId)
    .maybeSingle();
  if (!connection) {
    console.warn(`WA webhook: unknown waba_id ${wabaId}, dropping template status event.`);
    return;
  }

  await admin
    .from("wa_templates")
    .update({ status: value.event })
    .eq("wa_connection_id", connection.id)
    .eq("name", value.message_template_name)
    .eq("language", value.message_template_language);
}

async function handleQualityUpdate(admin: ReturnType<typeof createAdminClient>, value: any) {
  const phoneNumberId = value.phone_number ?? value.display_phone_number;
  if (!phoneNumberId) return;

  const { data: connection } = await admin
    .from("wa_connections")
    .select("id, workspace_id")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  if (!connection) return;

  await admin
    .from("wa_connections")
    .update({ quality_rating: value.current_limit ? value.current_limit : value.event })
    .eq("id", connection.id);

  // Quality/tier degradation pauses active marketing broadcasts on this number —
  // protecting the customer's number rating is a hard rule, not a suggestion.
  if (value.event === "DOWNGRADE" || value.current_limit === "RED") {
    await admin
      .from("wa_broadcasts")
      .update({ status: "paused" })
      .eq("wa_connection_id", connection.id)
      .eq("status", "sending");
  }
}
