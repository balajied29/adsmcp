import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { devMode } from "@/lib/dev";

const E164 = /^[1-9]\d{6,14}$/; // digits only, no leading +, matches WA's wire format

const singleSchema = z.object({
  phone: z.string().regex(E164, "Use digits only, country code first, no leading +"),
  displayName: z.string().optional(),
  tags: z.array(z.string()).default([]),
  optInSource: z.string().default("manual"),
});

const bulkSchema = z.object({
  contacts: z.array(singleSchema).min(1).max(5000),
});

/** POST — add one contact ({phone,...}) or bulk import ({contacts:[...]}). */
export async function POST(request: NextRequest) {
  if (devMode()) {
    return NextResponse.json({ ok: true, note: "Dev mode — contacts aren't persisted." });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await request.json();
  const bulk = bulkSchema.safeParse(raw);
  const rows = bulk.success ? bulk.data.contacts : [singleSchema.parse(raw)];

  const { error, count } = await supabase
    .from("wa_contacts")
    .upsert(
      rows.map((r) => ({
        workspace_id: user.id,
        phone_e164: r.phone,
        display_name: r.displayName ?? null,
        tags: r.tags,
        opt_in_source: r.optInSource,
      })),
      { onConflict: "workspace_id,phone_e164", count: "exact" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count });
}
