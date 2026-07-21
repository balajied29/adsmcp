/**
 * WhatsApp broadcast dispatcher — run on a short cron (target: every minute;
 * GitHub Actions realistically delivers ~every 5 min, which is an accepted
 * limitation for beta volume — see docs/TECHNICAL.md §8 dispatcher research
 * item for the path to true minute-level draining).
 *
 *   npm run wa-dispatch             real mode: drains every sending broadcast
 *   npm run wa-dispatch -- --dry-run  mock client, no DB writes
 *
 * Claim strategy: an optimistic `status = 'queued' -> 'claimed'` conditional
 * update scoped to the selected row ids. This is weaker than a true
 * `FOR UPDATE SKIP LOCKED` (which needs a Postgres function via RPC) but is
 * safe for a single-runner cron; documented as a hardening item, not silently
 * assumed safe under concurrent dispatchers.
 */
import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { WaAdsClient, WaApiError } from "@adpilot/wa-client";
import { createMockWaClient, MOCK_WA_CONNECTION } from "@adpilot/wa-client/mock";
import { decryptToken } from "./crypto.js";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE_PER_BROADCAST = 25; // spreads a large audience across multiple cron runs
const MAX_ATTEMPTS = 3;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

interface QueueRow {
  id: string;
  contact_id: string;
  idempotency_key: string;
  rendered_variables: Record<string, string>;
  attempts: number;
}

function orderedBodyParams(vars: Record<string, string>): string[] {
  return Object.keys(vars)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => vars[k]!);
}

async function drainBroadcast(
  supabase: SupabaseClient,
  wa: WaAdsClient,
  workspaceId: string,
  broadcastId: string,
  templateName: string,
  templateLanguage: string,
  contactsById: Map<string, { phone_e164: string; opted_out: boolean }>,
): Promise<{ sent: number; failed: number; remaining: number }> {
  const { data: queued } = await supabase
    .from("wa_outbound_queue")
    .select("id, contact_id, idempotency_key, rendered_variables, attempts")
    .eq("broadcast_id", broadcastId)
    .eq("status", "queued")
    .limit(BATCH_SIZE_PER_BROADCAST);

  const batch = (queued ?? []) as QueueRow[];
  let sent = 0;
  let failed = 0;

  for (const row of batch) {
    // Optimistic claim — see module docstring on the concurrency caveat.
    const { data: claimed } = await supabase
      .from("wa_outbound_queue")
      .update({ status: "claimed", claimed_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (!claimed) continue; // lost the race to another runner

    const contact = contactsById.get(row.contact_id);
    if (!contact || contact.opted_out) {
      // Defensive re-check: consent can change between enqueue and send.
      await supabase
        .from("wa_outbound_queue")
        .update({ status: "failed", error_code: "opted_out" })
        .eq("id", row.id);
      failed++;
      continue;
    }

    try {
      const result = await wa.sendTemplateMessage({
        to: contact.phone_e164,
        templateName,
        languageCode: templateLanguage,
        bodyParams: orderedBodyParams(row.rendered_variables),
      });
      await supabase
        .from("wa_outbound_queue")
        .update({ status: "sent", wamid: result.wamid })
        .eq("id", row.id);
      await supabase.from("wa_send_log").insert({
        workspace_id: workspaceId,
        broadcast_id: broadcastId,
        contact_id: row.contact_id,
        wamid: result.wamid,
        event: "sent",
      });
      sent++;
    } catch (err) {
      const waErr = err instanceof WaApiError ? err : null;
      const attempts = row.attempts + 1;
      const retryable = (waErr?.retryable ?? true) && attempts < MAX_ATTEMPTS;

      await supabase
        .from("wa_outbound_queue")
        .update({
          status: retryable ? "queued" : "failed",
          attempts,
          error_code: waErr?.code ? String(waErr.code) : null,
        })
        .eq("id", row.id);
      await supabase.from("wa_send_log").insert({
        workspace_id: workspaceId,
        broadcast_id: broadcastId,
        contact_id: row.contact_id,
        event: "failed",
        error_code: waErr?.code ? String(waErr.code) : null,
        error_message: err instanceof Error ? err.message : String(err),
      });
      if (!retryable) failed++;
    }
  }

  if (sent > 0) {
    const { data: current } = await supabase
      .from("wa_broadcasts")
      .select("sent_count")
      .eq("id", broadcastId)
      .single();
    await supabase
      .from("wa_broadcasts")
      .update({ sent_count: (current?.sent_count ?? 0) + sent })
      .eq("id", broadcastId);
  }

  const { count: remaining } = await supabase
    .from("wa_outbound_queue")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", broadcastId)
    .eq("status", "queued");

  return { sent, failed, remaining: remaining ?? 0 };
}

async function main(): Promise<void> {
  if (DRY_RUN) {
    console.log("Dry run: dispatching against the mock WhatsApp client (no DB writes).");
    const wa = createMockWaClient();
    const result = await wa.sendTemplateMessage({
      to: "15550101001",
      templateName: "weekend_sale",
      languageCode: "en_US",
      bodyParams: ["Jordan", "https://shop.example.com/sale"],
    });
    console.log(`Mock send OK — wamid ${result.wamid} from ${MOCK_WA_CONNECTION.display_phone_number}`);
    return;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL ?? requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data: broadcasts, error } = await supabase
    .from("wa_broadcasts")
    .select(
      "id, workspace_id, name, wa_connection_id, wa_templates ( name, language ), wa_connections ( encrypted_token, phone_number_id )",
    )
    .eq("status", "sending");
  if (error) throw new Error(`Failed to list sending broadcasts: ${error.message}`);

  console.log(`WA dispatch run: ${broadcasts?.length ?? 0} broadcast(s) sending.`);

  for (const b of broadcasts ?? []) {
    const label = `${b.name} (${b.id})`;
    try {
      const template = b.wa_templates as unknown as { name: string; language: string } | null;
      const connection = b.wa_connections as unknown as {
        encrypted_token: string;
        phone_number_id: string;
      } | null;
      if (!template || !connection) throw new Error("Missing template or connection join");

      // Load only the contacts referenced by this batch's queue rows.
      const { data: queuedContactIds } = await supabase
        .from("wa_outbound_queue")
        .select("contact_id")
        .eq("broadcast_id", b.id)
        .eq("status", "queued")
        .limit(BATCH_SIZE_PER_BROADCAST);
      const contactIds = [...new Set((queuedContactIds ?? []).map((r) => r.contact_id))];
      const { data: contacts } = await supabase
        .from("wa_contacts")
        .select("id, phone_e164, opted_out")
        .in("id", contactIds.length ? contactIds : ["00000000-0000-0000-0000-000000000000"]);
      const contactsById = new Map((contacts ?? []).map((c) => [c.id, c]));

      const wa = new WaAdsClient(decryptToken(connection.encrypted_token), connection.phone_number_id);
      const { sent, failed, remaining } = await drainBroadcast(
        supabase,
        wa,
        b.workspace_id,
        b.id,
        template.name,
        template.language,
        contactsById,
      );

      console.log(`  ${label}: sent ${sent}, failed ${failed}, ${remaining} still queued`);

      if (remaining === 0) {
        await supabase.from("wa_broadcasts").update({ status: "sent" }).eq("id", b.id);
      }
    } catch (err) {
      console.error(`✗ ${label}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
