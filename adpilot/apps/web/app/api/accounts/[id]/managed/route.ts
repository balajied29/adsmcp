import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { devMode } from "@/lib/dev";

const bodySchema = z.object({ managed: z.boolean() });

/** PATCH — toggle whether the daily audit worker covers this account. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  if (devMode()) return NextResponse.json({ ok: true, managed: parsed.data.managed });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("ad_accounts")
    .update({ managed: parsed.data.managed })
    .eq("id", id); // RLS scopes to the owner
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, managed: parsed.data.managed });
}
