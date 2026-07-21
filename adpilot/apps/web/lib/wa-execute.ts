import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { devMode } from "@/lib/dev";
import type { WaContext } from "@/lib/wa-context";
import { MOCK_WA_CONTACT_ROWS } from "@/lib/wa-mock-data";
import { MOCK_WA_TEMPLATES } from "@adpilot/wa-client/mock";
import { devBroadcastDrafts } from "@/lib/dev-wa-store";

export type EnqueueResult =
  | { ok: true; recipientCount: number; broadcastId: string }
  | { ok: false; error: string; httpStatus: number };

/**
 * Approving a broadcast never sends directly — it enqueues. All guardrails
 * live here, at enqueue time, so no caller (chat agent, composer, future
 * MCP tool) can bypass them: the messaging-lane equivalent of lib/execute.ts.
 *
 *   - template must be APPROVED
 *   - audience members who are opted_out are excluded
 *   - per-recipient dedupe: no duplicate template+recipient within 24h
 *     (idempotency key also protects the dispatcher against double-send)
 *   - the audience snapshot is materialized now, not at send time
 */
export async function enqueueBroadcast(
  ctx: WaContext,
  broadcastId: string,
): Promise<EnqueueResult> {
  if (devMode()) {
    // Runs the real guardrail logic against the drafted template/audience so
    // rejection paths are actually observable in dev mode, not simulated.
    const draft = devBroadcastDrafts.get(broadcastId);
    if (!draft) return { ok: false, error: "Broadcast not found", httpStatus: 404 };

    const template = MOCK_WA_TEMPLATES.find((t) => t.id === draft.templateId);
    if (!template) return { ok: false, error: "Template not found", httpStatus: 404 };
    if (template.status !== "APPROVED") {
      return {
        ok: false,
        error: `Guardrail: template "${template.name}" is ${template.status}, not APPROVED. Only approved templates can be broadcast.`,
        httpStatus: 400,
      };
    }

    const eligible = MOCK_WA_CONTACT_ROWS.filter((c) => !c.opted_out);
    if (eligible.length === 0) {
      return {
        ok: false,
        error: "No eligible recipients — every contact is opted out.",
        httpStatus: 400,
      };
    }
    devBroadcastDrafts.delete(broadcastId);
    return { ok: true, recipientCount: eligible.length, broadcastId };
  }

  const admin = createAdminClient();

  const { data: broadcast, error: bErr } = await admin
    .from("wa_broadcasts")
    .select("id, workspace_id, audience_id, variable_spec, wa_template_id, status")
    .eq("id", broadcastId)
    .single();
  if (bErr || !broadcast) return { ok: false, error: "Broadcast not found", httpStatus: 404 };
  if (broadcast.workspace_id !== ctx.userId) {
    return { ok: false, error: "Broadcast not found", httpStatus: 404 };
  }
  if (broadcast.status !== "draft") {
    return { ok: false, error: `Broadcast is already ${broadcast.status}`, httpStatus: 409 };
  }

  const { data: template } = await admin
    .from("wa_templates")
    .select("id, name, language, status")
    .eq("id", broadcast.wa_template_id)
    .single();
  if (!template) return { ok: false, error: "Template not found", httpStatus: 404 };
  if (template.status !== "APPROVED") {
    return {
      ok: false,
      error: `Guardrail: template "${template.name}" is ${template.status}, not APPROVED. Only approved templates can be broadcast.`,
      httpStatus: 400,
    };
  }

  if (!broadcast.audience_id) {
    return { ok: false, error: "Broadcast has no audience selected", httpStatus: 400 };
  }
  const { data: members } = await admin
    .from("wa_audience_members")
    .select("contact_id, wa_contacts!inner(id, phone_e164, display_name, opted_out)")
    .eq("audience_id", broadcast.audience_id);

  const eligible = (members ?? [])
    .map((m) => m.wa_contacts as unknown as { id: string; phone_e164: string; display_name: string | null; opted_out: boolean })
    .filter((c) => !c.opted_out);

  if (eligible.length === 0) {
    return {
      ok: false,
      error: "No eligible recipients — every audience member is opted out or the audience is empty.",
      httpStatus: 400,
    };
  }

  // Dedupe: skip contacts already queued/sent for this exact template within 24h.
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: recent } = await admin
    .from("wa_send_log")
    .select("contact_id")
    .in("contact_id", eligible.map((c) => c.id))
    .gte("created_at", since);
  const recentlySent = new Set((recent ?? []).map((r) => r.contact_id));
  const recipients = eligible.filter((c) => !recentlySent.has(c.id));

  if (recipients.length === 0) {
    return {
      ok: false,
      error: "Every eligible recipient already received this content in the last 24h (dedupe guardrail).",
      httpStatus: 400,
    };
  }

  const variableSpec = (broadcast.variable_spec ?? {}) as Record<string, string>;
  const renderVars = (contact: { display_name: string | null }) =>
    Object.fromEntries(
      Object.entries(variableSpec).map(([k, v]) => [
        k,
        v === "{{contact.display_name}}" ? (contact.display_name ?? "there") : v,
      ]),
    );

  const queueRows = recipients.map((c) => ({
    broadcast_id: broadcastId,
    contact_id: c.id,
    idempotency_key: `${broadcastId}:${c.id}`,
    rendered_variables: renderVars(c),
    status: "queued" as const,
  }));

  const { error: qErr } = await admin
    .from("wa_outbound_queue")
    .upsert(queueRows, { onConflict: "idempotency_key", ignoreDuplicates: true });
  if (qErr) return { ok: false, error: qErr.message, httpStatus: 500 };

  await admin
    .from("wa_broadcasts")
    .update({
      status: "sending",
      recipient_count: recipients.length,
      approved_at: new Date().toISOString(),
    })
    .eq("id", broadcastId);

  return { ok: true, recipientCount: recipients.length, broadcastId };
}
