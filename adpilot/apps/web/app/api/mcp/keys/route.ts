import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { devMode } from "@/lib/dev";
import { generateKey, hashKey, DEV_MCP_KEY } from "@/lib/mcp-auth";

/** POST — mint a new MCP bearer key. The plaintext is returned exactly once. */
export async function POST() {
  if (devMode()) {
    return NextResponse.json({ key: DEV_MCP_KEY, id: "dev-key", label: "Dev key" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = generateKey();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mcp_keys")
    .insert({ workspace_id: user.id, key_hash: hashKey(key), label: "MCP key" })
    .select("id, label, created_at")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create key" }, { status: 500 });
  }
  return NextResponse.json({ key, id: data.id, label: data.label });
}

/** DELETE ?id= — revoke a key (RLS scopes to the owner). */
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (devMode()) return NextResponse.json({ ok: true });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("mcp_keys").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
