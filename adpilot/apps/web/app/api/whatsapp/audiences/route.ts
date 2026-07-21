import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { devMode } from "@/lib/dev";

const bodySchema = z.object({
  name: z.string().min(1),
  contactIds: z.array(z.string()).default([]),
  tag: z.string().optional(), // convenience: build from all contacts carrying this tag
});

/** POST — create an audience from explicit contact ids and/or a tag filter. */
export async function POST(request: NextRequest) {
  if (devMode()) {
    return NextResponse.json({ ok: true, id: "dev-audience", note: "Dev mode — not persisted." });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { data: audience, error: audErr } = await supabase
    .from("wa_audiences")
    .insert({ workspace_id: user.id, name: parsed.data.name })
    .select("id")
    .single();
  if (audErr || !audience) {
    return NextResponse.json({ error: audErr?.message ?? "Failed" }, { status: 500 });
  }

  let contactIds = [...parsed.data.contactIds];
  if (parsed.data.tag) {
    const { data: tagged } = await supabase
      .from("wa_contacts")
      .select("id")
      .contains("tags", [parsed.data.tag])
      .eq("opted_out", false);
    contactIds.push(...(tagged ?? []).map((c) => c.id));
  }
  contactIds = [...new Set(contactIds)];

  if (contactIds.length) {
    const { error: memberErr } = await supabase
      .from("wa_audience_members")
      .insert(contactIds.map((contact_id) => ({ audience_id: audience.id, contact_id })));
    if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: audience.id, memberCount: contactIds.length });
}
