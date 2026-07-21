import { NextResponse } from "next/server";
import { getWaContext } from "@/lib/wa-context";
import { enqueueBroadcast } from "@/lib/wa-execute";

/** POST — the one human-approval gate. Runs every guardrail, then enqueues. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; broadcastId: string }> },
) {
  const { id, broadcastId } = await params;
  const ctx = await getWaContext(id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await enqueueBroadcast(ctx, broadcastId);
  return result.ok
    ? NextResponse.json({ ok: true, recipientCount: result.recipientCount })
    : NextResponse.json({ error: result.error }, { status: result.httpStatus });
}
