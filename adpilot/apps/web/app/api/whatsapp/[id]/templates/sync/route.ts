import { NextResponse } from "next/server";
import { getWaContext } from "@/lib/wa-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { devMode } from "@/lib/dev";

/** POST — pull templates from Meta and reconcile the local mirror. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getWaContext(id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const templates = await ctx.wa.listTemplates(ctx.connection.waba_id);

    if (!devMode()) {
      const admin = createAdminClient();
      const { error } = await admin.from("wa_templates").upsert(
        templates.map((t) => ({
          workspace_id: ctx.userId,
          wa_connection_id: ctx.connection.id,
          meta_template_id: t.id,
          name: t.name,
          language: t.language,
          category: t.category,
          status: t.status,
          components: t.components,
        })),
        { onConflict: "wa_connection_id,name,language" },
      );
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, count: templates.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 502 },
    );
  }
}
