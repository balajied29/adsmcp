import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAccountContext } from "@/lib/account";

const bodySchema = z.object({
  audience: z.object({
    countries: z.array(z.string().length(2)).min(1),
    ageMin: z.number().int().min(18).max(65).optional(),
    ageMax: z.number().int().min(18).max(65).optional(),
    genders: z.enum(["all", "male", "female"]).optional(),
    interestIds: z.array(z.string()).optional(),
    customAudienceIds: z.array(z.string()).optional(),
    excludedCustomAudienceIds: z.array(z.string()).optional(),
  }),
  placements: z
    .object({
      publisherPlatforms: z
        .array(z.enum(["facebook", "instagram", "audience_network", "messenger"]))
        .optional(),
      facebookPositions: z.array(z.string()).optional(),
      instagramPositions: z.array(z.string()).optional(),
    })
    .optional(),
  optimizationGoal: z.string().optional(),
});

/** POST — audience size estimate for the current wizard selection. */
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

  try {
    const estimate = await ctx.meta.launch.estimateAudience(
      ctx.account.account_id,
      parsed.data.audience,
      parsed.data.placements as never,
      parsed.data.optimizationGoal,
    );
    return NextResponse.json({ estimate });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Estimate failed" },
      { status: 502 },
    );
  }
}
