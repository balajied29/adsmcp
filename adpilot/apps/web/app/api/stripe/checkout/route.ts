import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { devMode } from "@/lib/dev";

/**
 * POST — create a Stripe Checkout session for the Pro subscription and
 * redirect to it. Raw Stripe REST call (form-encoded) — no SDK needed for
 * one endpoint. Requires STRIPE_SECRET_KEY + STRIPE_PRICE_ID.
 */
export async function POST(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  if (devMode()) {
    return NextResponse.redirect(`${appUrl}/dashboard/billing?dev_checkout=1`, 303);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!secretKey || !priceId) {
    return NextResponse.json(
      { error: "Billing isn't configured (missing STRIPE_SECRET_KEY / STRIPE_PRICE_ID)." },
      { status: 501 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${appUrl}/login`, 303);

  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    client_reference_id: user.id,
    customer_email: user.email ?? "",
    success_url: `${appUrl}/dashboard/billing?upgraded=1`,
    cancel_url: `${appUrl}/dashboard/billing?canceled=1`,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const json = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok || !json.url) {
    return NextResponse.json(
      { error: json.error?.message ?? "Stripe checkout failed" },
      { status: 502 },
    );
  }
  return NextResponse.redirect(json.url, 303);
}
