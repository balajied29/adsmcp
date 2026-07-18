import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAccountContext } from "@/lib/account";

const bodySchema = z.object({
  pixelId: z.string().min(1),
  eventName: z.string().default("PageView"),
  testEventCode: z.string().optional(),
  eventSourceUrl: z.string().url().optional(),
});

/** POST — fire a Conversions API test event so the user can verify their CAPI setup. */
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

  try {
    const result = await ctx.meta.launch.sendCapiEvent(parsed.data.pixelId, {
      eventName: parsed.data.eventName,
      testEventCode: parsed.data.testEventCode,
      eventSourceUrl: parsed.data.eventSourceUrl,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "CAPI event failed" },
      { status: 502 },
    );
  }
}
