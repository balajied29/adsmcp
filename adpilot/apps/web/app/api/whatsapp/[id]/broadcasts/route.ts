import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getWaContext } from "@/lib/wa-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { devMode } from "@/lib/dev";
import { devBroadcastDrafts } from "@/lib/dev-wa-store";

const bodySchema = z.object({
  name: z.string().min(1),
  templateId: z.string().min(1),
  audienceId: z.string().min(1),
  /** e.g. {"1": "{{contact.display_name}}", "2": "https://shop.example.com/sale"} */
  variableSpec: z.record(z.string(), z.string()).default({}),
});

/** POST — create a draft broadcast. Drafting never sends; approve() does. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getWaContext(id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  if (devMode()) {
    const draftId = `dev-broadcast-${Date.now()}`;
    devBroadcastDrafts.set(draftId, {
      templateId: parsed.data.templateId,
      audienceId: parsed.data.audienceId,
    });
    return NextResponse.json({ ok: true, id: draftId, status: "draft" });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wa_broadcasts")
    .insert({
      workspace_id: ctx.userId,
      wa_connection_id: ctx.connection.id,
      wa_template_id: parsed.data.templateId,
      audience_id: parsed.data.audienceId,
      name: parsed.data.name,
      variable_spec: parsed.data.variableSpec,
      status: "draft",
    })
    .select("id, status")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...data });
}
