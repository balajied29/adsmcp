import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAccountContext } from "@/lib/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { devMode } from "@/lib/dev";

const bodySchema = z.object({
  campaign: z.object({
    name: z.string().min(1),
    objective: z.enum([
      "OUTCOME_AWARENESS",
      "OUTCOME_TRAFFIC",
      "OUTCOME_ENGAGEMENT",
      "OUTCOME_LEADS",
      "OUTCOME_APP_PROMOTION",
      "OUTCOME_SALES",
    ]),
    specialAdCategories: z.array(z.string()).default([]),
  }),
  adset: z.object({
    name: z.string().min(1),
    dailyBudget: z.number().positive().optional(),
    lifetimeBudget: z.number().positive().optional(),
    optimizationGoal: z.string().default("LINK_CLICKS"),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    pixelId: z.string().optional(),
    customEventType: z.string().optional(),
    audience: z.object({
      countries: z.array(z.string().length(2)).min(1),
      ageMin: z.number().int().min(18).max(65).default(18),
      ageMax: z.number().int().min(18).max(65).default(65),
      genders: z.enum(["all", "male", "female"]).default("all"),
      interestIds: z.array(z.string()).default([]),
      customAudienceIds: z.array(z.string()).default([]),
      excludedCustomAudienceIds: z.array(z.string()).default([]),
    }),
    placements: z
      .object({
        publisherPlatforms: z
          .array(z.enum(["facebook", "instagram", "audience_network", "messenger"]))
          .default([]),
        facebookPositions: z.array(z.string()).default([]),
        instagramPositions: z.array(z.string()).default([]),
      })
      .optional(),
  }),
  ad: z.object({
    name: z.string().min(1),
    pageId: z.string().min(1),
    message: z.string().min(1),
    link: z.string().url(),
    headline: z.string().optional(),
    imageHash: z.string().optional(),
    callToAction: z.string().optional(),
  }),
  /** Everything is created PAUSED unless this is explicitly true. */
  activate: z.boolean().default(false),
});

/**
 * POST — deploys a full campaign -> ad set -> ad chain. Objects are created
 * PAUSED unless `activate: true` is passed explicitly. Every launch is
 * recorded in the action_log.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAccountContext(id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { campaign, adset, ad, activate } = parsed.data;

  if (Boolean(adset.dailyBudget) === Boolean(adset.lifetimeBudget)) {
    return NextResponse.json(
      { error: "Set exactly one of dailyBudget or lifetimeBudget." },
      { status: 400 },
    );
  }
  if (adset.lifetimeBudget && !adset.endTime) {
    return NextResponse.json(
      { error: "A lifetime budget requires an end date." },
      { status: 400 },
    );
  }

  const status = activate ? ("ACTIVE" as const) : ("PAUSED" as const);
  const acct = ctx.account.account_id;

  const log = async (
    action: string,
    targetObjectId: string,
    payload: unknown,
    result: "success" | "error",
    errorMessage?: string,
  ) => {
    if (devMode()) return; // no DB in dev login mode
    const admin = createAdminClient();
    await admin.from("action_log").insert({
      workspace_id: ctx.userId,
      ad_account_id: ctx.account.id,
      actor: "user",
      action,
      target_object_id: targetObjectId,
      payload: payload as never,
      result,
      error_message: errorMessage ?? null,
    });
  };

  let campaignId: string | undefined;
  let adsetId: string | undefined;
  try {
    campaignId = await ctx.meta.launch.createCampaign(acct, {
      name: campaign.name,
      objective: campaign.objective,
      specialAdCategories: campaign.specialAdCategories,
      status,
    });
    await log("create_campaign", campaignId, { name: campaign.name, status }, "success");

    adsetId = await ctx.meta.launch.createAdSet(acct, {
      campaignId,
      name: adset.name,
      dailyBudget: adset.dailyBudget,
      lifetimeBudget: adset.lifetimeBudget,
      optimizationGoal: adset.optimizationGoal,
      audience: adset.audience,
      placements: adset.placements as never,
      startTime: adset.startTime,
      endTime: adset.endTime,
      pixelId: adset.pixelId,
      customEventType: adset.customEventType,
      status,
    });
    await log("create_adset", adsetId, { name: adset.name, status }, "success");

    const adId = await ctx.meta.launch.createAd(acct, {
      adsetId,
      name: ad.name,
      pageId: ad.pageId,
      message: ad.message,
      link: ad.link,
      headline: ad.headline,
      imageHash: ad.imageHash,
      callToAction: ad.callToAction,
      status,
    });
    await log("create_ad", adId, { name: ad.name, status }, "success");

    return NextResponse.json({ campaignId, adsetId, adId, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Launch failed";
    await log(
      "launch_failed",
      adsetId ?? campaignId ?? "none",
      { campaign: campaign.name },
      "error",
      message,
    );
    return NextResponse.json(
      {
        error: message,
        // Partial creations stay PAUSED on Meta; surface them so the user can clean up.
        created: { campaignId, adsetId },
      },
      { status: 502 },
    );
  }
}
