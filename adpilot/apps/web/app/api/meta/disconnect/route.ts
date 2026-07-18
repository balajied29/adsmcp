import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { devMode } from "@/lib/dev";

/**
 * POST — disconnect Meta: deletes the user's connections (and, via cascade,
 * their ad account rows and the encrypted tokens). RLS scopes the delete.
 */
export async function POST(request: NextRequest) {
  if (devMode()) {
    // Dev mode has no DB — just bounce back so the UI flow is testable.
    return NextResponse.redirect(new URL("/dashboard/integrations?dev_noop=1", request.url));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  await supabase.from("meta_connections").delete().eq("workspace_id", user.id);
  return NextResponse.redirect(new URL("/dashboard/integrations?disconnected=1", request.url));
}
