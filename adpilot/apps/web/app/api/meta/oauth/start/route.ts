import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { buildOAuthDialogUrl } from "@adpilot/meta-client";
import { createClient } from "@/lib/supabase/server";

/**
 * Starts the "Connect Meta" flow: requires a signed-in user, sets a CSRF
 * state cookie, and redirects to the Facebook Login dialog requesting
 * ads_read + ads_management + business_management.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = crypto.randomBytes(24).toString("hex");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const redirectUri = `${appUrl}/api/meta/oauth/callback`;

  const response = NextResponse.redirect(
    buildOAuthDialogUrl(process.env.META_APP_ID!, redirectUri, state),
  );
  response.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
