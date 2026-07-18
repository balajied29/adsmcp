import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAccountContext } from "@/lib/account";
import { executeAction } from "@/lib/execute";
import { createAdminClient } from "@/lib/supabase/admin";
import { devMode } from "@/lib/dev";

const bodySchema = z.object({
  recommendationId: z.string().nullable(), // null in dev mode (no DB rows)
  accountRowId: z.string().min(1),
  title: z.string().min(1),
  decision: z.enum(["approve", "dismiss"]),
  action: z
    .object({
      kind: z.enum(["pause_object", "resume_object", "budget_change"]),
      objectId: z.string().min(1),
      budgetType: z.enum(["daily", "lifetime"]).optional(),
      amount: z.number().positive().optional(),
    })
    .nullable(),
});

/**
 * POST — resolve one queued recommendation.
 * approve + executable action -> runs through the guardrailed execute path,
 *   then marks the row executed/failed.
 * approve without action (manual task) -> marks the row approved.
 * dismiss -> marks the row dismissed.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { recommendationId, accountRowId, title, decision, action } = parsed.data;

  const ctx = await getAccountContext(accountRowId);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const setStatus = async (status: "approved" | "dismissed" | "executed" | "failed") => {
    if (devMode() || !recommendationId) return;
    const admin = createAdminClient();
    await admin
      .from("recommendations")
      .update({ status, resolved_at: new Date().toISOString() })
      .eq("id", recommendationId)
      .eq("workspace_id", ctx.userId); // ownership re-check (admin bypasses RLS)
  };

  if (decision === "dismiss") {
    await setStatus("dismissed");
    return NextResponse.json({ ok: true, status: "dismissed" });
  }

  // approve
  if (!action) {
    await setStatus("approved");
    return NextResponse.json({
      ok: true,
      status: "approved",
      message: "Accepted — this one's on your list to do manually.",
    });
  }

  const result = await executeAction(ctx, title, action, recommendationId);
  if (result.ok) {
    await setStatus("executed");
    return NextResponse.json({ ok: true, status: "executed", message: result.message });
  }
  await setStatus("failed");
  return NextResponse.json({ error: result.error }, { status: result.httpStatus });
}
