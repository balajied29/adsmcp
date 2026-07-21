import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getWaContext } from "@/lib/wa-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { devMode } from "@/lib/dev";

const bodySchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores only"),
  language: z.string().min(2).default("en_US"),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  bodyText: z.string().min(1).max(1024),
  headerText: z.string().optional(),
  footerText: z.string().optional(),
});

/** POST — submit a new template to Meta for approval; mirrored locally as PENDING. */
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

  try {
    const result = await ctx.wa.createTemplate(ctx.connection.waba_id, parsed.data);

    if (!devMode()) {
      const admin = createAdminClient();
      await admin.from("wa_templates").upsert(
        {
          workspace_id: ctx.userId,
          wa_connection_id: ctx.connection.id,
          meta_template_id: result.id,
          name: parsed.data.name,
          language: parsed.data.language,
          category: parsed.data.category,
          status: result.status,
          components: [{ type: "BODY", text: parsed.data.bodyText }],
        },
        { onConflict: "wa_connection_id,name,language" },
      );
    }

    return NextResponse.json({ ok: true, id: result.id, status: result.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Template submission failed" },
      { status: 502 },
    );
  }
}
