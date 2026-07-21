import { NextResponse } from "next/server";
import { getWaContext } from "@/lib/wa-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { devMode } from "@/lib/dev";

/**
 * POST — kill switch. Marks the broadcast cancelled; the dispatcher checks
 * broadcast status on every claimed batch and stops sending mid-flight.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; broadcastId: string }> },
) {
  const { id, broadcastId } = await params;
  const ctx = await getWaContext(id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (devMode()) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const { error } = await admin
    .from("wa_broadcasts")
    .update({ status: "cancelled" })
    .eq("id", broadcastId)
    .eq("workspace_id", ctx.userId)
    .in("status", ["draft", "approved", "sending", "paused"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
