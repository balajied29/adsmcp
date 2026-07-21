/**
 * The nightly audit brain: a Claude tool loop that reads account performance
 * and submits structured recommendations matching the `recommendations` table.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
// The SDK's zod helper is typed against zod v4 (shipped as a subpath of zod 3.25+).
import { z } from "zod/v4";
import type { MetaAdsClient } from "@adpilot/meta-client";

const MODEL = "claude-opus-4-8";

export interface AuditAccount {
  accountId: string; // act_XXXX
  name: string;
  currency: string;
}

export interface AuditRecommendation {
  kind: "pause_object" | "resume_object" | "budget_change" | "creative_refresh" | "observation";
  title: string;
  rationale: string;
  estimatedImpact: string;
  /** Executable payload for pause/resume/budget kinds. */
  action: { objectId: string; budgetType?: "daily" | "lifetime"; amount?: number } | null;
}

export interface AuditResult {
  summary: string;
  score: number;
  recommendations: AuditRecommendation[];
}

function systemPrompt(account: AuditAccount): string {
  return `You are AP/S's nightly audit agent for the Meta ad account "${account.name}" (${account.accountId}, currency ${account.currency}).

Job: audit the account's recent performance and submit your findings ONCE via submit_audit. This runs unattended — a human reads the digest later and approves actions in the UI.

Rules:
- Fetch real data first (get_performance for last_7d AND last_30d to see trends; list_pixels for tracking health). Never invent numbers.
- Every recommendation's rationale must contain the arithmetic (e.g. "CPA 38.75 vs account average 14.30 — 2.7x worse").
- Prefer few high-confidence recommendations over many speculative ones. Use kind "observation" for things worth knowing that need no action.
- Executable kinds (pause_object, resume_object, budget_change) must include the object_id from the data. Budget changes must stay within 5x of the current budget — larger ones are blocked by a hard guardrail.
- creative_refresh and pixel/tracking issues are manual tasks — no object_id required.
- score: overall account health 0-100 (90+ excellent, 70s solid with leaks, 50s needs work, below 40 urgent).`;
}

export async function runAuditAgent(
  meta: MetaAdsClient,
  account: AuditAccount,
): Promise<AuditResult> {
  let result: AuditResult | null = null;

  const getPerformance = betaZodTool({
    name: "get_performance",
    description:
      "Campaigns plus per-campaign and account-total metrics (spend, CTR, CPC, reach, frequency, conversions, ROAS) for a date range.",
    inputSchema: z.object({
      date_preset: z.enum(["last_7d", "last_30d", "last_90d"]),
    }),
    run: async ({ date_preset }) => {
      const [campaigns, campaignInsights, accountTotals] = await Promise.all([
        meta.listCampaigns(account.accountId),
        meta.getInsights(account.accountId, { level: "campaign", datePreset: date_preset }),
        meta.getInsights(account.accountId, { level: "account", datePreset: date_preset }),
      ]);
      return JSON.stringify({ campaigns, campaignInsights, accountTotals: accountTotals[0] ?? null });
    },
  });

  const listPixels = betaZodTool({
    name: "list_pixels",
    description: "Account pixels with last-fired timestamps — tracking health check.",
    inputSchema: z.object({}),
    run: async () => JSON.stringify(await meta.launch.listPixels(account.accountId)),
  });

  const submitAudit = betaZodTool({
    name: "submit_audit",
    description: "Submit the final audit. Call exactly once, after fetching data.",
    inputSchema: z.object({
      summary: z
        .string()
        .describe("2-3 sentence digest of account health with the key numbers"),
      score: z.number().int().min(0).max(100),
      recommendations: z
        .array(
          z.object({
            kind: z.enum([
              "pause_object",
              "resume_object",
              "budget_change",
              "creative_refresh",
              "observation",
            ]),
            title: z.string(),
            rationale: z.string().describe("Why, with the arithmetic"),
            estimated_impact: z.string().describe("e.g. 'Saves ~$402/mo'"),
            object_id: z.string().optional(),
            budget_type: z.enum(["daily", "lifetime"]).optional(),
            amount: z.number().optional().describe("New budget in currency units"),
          }),
        )
        .min(1)
        .max(8),
    }),
    run: async (input) => {
      result = {
        summary: input.summary,
        score: input.score,
        recommendations: input.recommendations.map((r) => ({
          kind: r.kind,
          title: r.title,
          rationale: r.rationale,
          estimatedImpact: r.estimated_impact,
          action:
            r.object_id &&
            (r.kind === "pause_object" || r.kind === "resume_object" || r.kind === "budget_change")
              ? { objectId: r.object_id, budgetType: r.budget_type, amount: r.amount }
              : null,
        })),
      };
      return "Audit recorded. You're done — no further tool calls needed.";
    },
  });

  const client = new Anthropic();
  const runner = client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    system: systemPrompt(account),
    tools: [getPerformance, listPixels, submitAudit],
    messages: [
      {
        role: "user",
        content:
          "Run tonight's audit. Fetch last_7d and last_30d performance plus pixel health, then submit_audit.",
      },
    ],
  });

  for await (const _message of runner) {
    if (result) break; // audit submitted — stop consuming turns
  }

  if (!result) {
    throw new Error("Audit agent finished without calling submit_audit");
  }
  return result;
}
