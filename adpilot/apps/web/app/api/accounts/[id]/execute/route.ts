import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAccountContext } from "@/lib/account";
import { executeAction } from "@/lib/execute";

const bodySchema = z.object({
  title: z.string().min(1),
  action: z.object({
    kind: z.enum(["pause_object", "resume_object", "budget_change"]),
    objectId: z.string().min(1),
    budgetType: z.enum(["daily", "lifetime"]).optional(),
    amount: z.number().positive().optional(),
  }),
});

/** POST — execute one approved action (chat cards call this directly). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAccountContext(id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const result = await executeAction(ctx, parsed.data.title, parsed.data.action);
  return result.ok
    ? NextResponse.json({ ok: true, message: result.message })
    : NextResponse.json({ error: result.error }, { status: result.httpStatus });
}
