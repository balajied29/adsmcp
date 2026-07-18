import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
// The SDK's zod helper is typed against zod v4 (shipped as a subpath of zod 3.25+).
import { z } from "zod/v4";
import type { MetaAdsClient } from "@adpilot/meta-client";
import type { AgentBlock } from "@/app/dashboard/chat-types";

const MODEL = "claude-opus-4-8";

export interface AgentAccount {
  rowId: string;
  accountId: string;
  name: string;
  currency: string;
}

export interface HistoryTurn {
  role: "user" | "agent";
  text: string;
}

/** True when the SDK has something to authenticate with. */
export function agentCredentialsAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function systemPrompt(account: AgentAccount): string {
  return `You are AdPilot's AI media buyer, managing the user's connected Meta ad account.

Account: "${account.name}" (${account.accountId}), currency ${account.currency}.

Rules:
- Fetch real data with tools before citing any number. Never invent metrics. If a tool fails, say so plainly.
- For a full account audit / health check: fetch performance first, then call render_audit_card exactly once (score reflects overall account health), then close with one short line offering next steps.
- When the user wants a new campaign: base budget and estimates on the account's actual CPC/CPA/ROAS from tools, then call render_campaign_card exactly once. The UI attaches a launch button automatically — don't mention URLs.
- You can only PROPOSE changes. Execution happens when the user clicks Approve on an audit card action — never claim you already changed something. Attach executable payloads (pause_object / resume_object / budget_change with object_id from tools) to recommendations the platform can apply directly; budget changes beyond 5x the current budget are blocked by a hard guardrail, so never propose them.
- Recommendations must include the arithmetic that justifies them (e.g. "CPA 3.4x your account average").
- Style: short plain-text paragraphs. Bold key figures with **double asterisks** (the only formatting the UI renders). Amounts in ${account.currency}. No markdown headers, no bullet syntax; simple "1." numbering is fine.`;
}

/**
 * Run one agent turn. Data tools read through the caller's MetaAdsClient
 * (mock client in dev mode, live Graph API in production); render tools emit
 * the same typed blocks the chat UI already knows how to draw.
 */
export async function runAgent(opts: {
  meta: MetaAdsClient;
  account: AgentAccount;
  message: string;
  history: HistoryTurn[];
}): Promise<AgentBlock[]> {
  const { meta, account } = opts;
  const blocks: AgentBlock[] = [];

  const getPerformance = betaZodTool({
    name: "get_performance",
    description:
      "Fetch the account's campaigns plus performance metrics (spend, impressions, clicks, CTR, CPC, reach, frequency, conversions, ROAS) per campaign and as an account total, for a date range. Call this before making any claim about performance.",
    inputSchema: z.object({
      date_preset: z
        .enum(["last_7d", "last_30d", "last_90d"])
        .describe("Reporting window"),
    }),
    run: async ({ date_preset }) => {
      const [campaigns, campaignInsights, accountTotals] = await Promise.all([
        meta.listCampaigns(account.accountId),
        meta.getInsights(account.accountId, { level: "campaign", datePreset: date_preset }),
        meta.getInsights(account.accountId, { level: "account", datePreset: date_preset }),
      ]);
      return JSON.stringify({
        campaigns,
        campaignInsights,
        accountTotals: accountTotals[0] ?? null,
      });
    },
  });

  const listAdSets = betaZodTool({
    name: "list_adsets",
    description:
      "List the ad sets inside one campaign: budget, optimization goal, targeting summary, schedule, status.",
    inputSchema: z.object({
      campaign_id: z.string().describe("Campaign id from get_performance"),
    }),
    run: async ({ campaign_id }) => JSON.stringify(await meta.listAdSets(campaign_id)),
  });

  const listPixels = betaZodTool({
    name: "list_pixels",
    description:
      "List the account's Meta pixels with last-fired times — use to check tracking health.",
    inputSchema: z.object({}),
    run: async () => JSON.stringify(await meta.launch.listPixels(account.accountId)),
  });

  const renderAuditCard = betaZodTool({
    name: "render_audit_card",
    description:
      "Display a rich audit card to the user (score ring, fix/strong lists, summary, biggest problem, recommended actions with approve buttons). Use exactly once per full audit, only after fetching real data.",
    inputSchema: z.object({
      score: z.number().int().min(0).max(100).describe("Overall account health 0-100"),
      fix: z.array(z.string()).min(1).max(4).describe("Short problem bullets, most costly first"),
      strong: z.array(z.string()).min(1).max(4).describe("Short strength bullets"),
      summary: z
        .string()
        .describe("One-sentence spend/results summary with **bold** figures"),
      biggest_problem: z
        .array(z.string())
        .min(1)
        .max(3)
        .describe("1-3 short paragraphs on the single most costly issue, with **bold** figures"),
      actions: z
        .array(
          z.object({
            title: z.string(),
            detail: z.string().describe("Expected impact, with the arithmetic"),
            kind: z
              .enum(["pause_object", "resume_object", "budget_change", "manual"])
              .describe(
                "Executable kind. Use 'manual' for things the user must do themselves (creative refresh, pixel fixes).",
              ),
            object_id: z
              .string()
              .optional()
              .describe("Campaign/ad set/ad id from tools — required unless kind is manual"),
            budget_type: z.enum(["daily", "lifetime"]).optional(),
            amount: z
              .number()
              .optional()
              .describe("New budget in currency units (budget_change only, must be within 5x of current)"),
          }),
        )
        .min(1)
        .max(5)
        .describe(
          "Concrete actions. Attach executable payloads (kind + object_id) whenever the platform can apply the change directly — the user approves with one click.",
        ),
    }),
    run: async (input) => {
      blocks.push({
        type: "audit",
        accountName: account.name,
        accountRowId: account.rowId,
        channel: "Meta Ads",
        score: input.score,
        fix: input.fix,
        strong: input.strong,
        summary: input.summary,
        biggestProblem: input.biggest_problem,
        actions: input.actions.map((a) => ({
          title: a.title,
          detail: a.detail,
          action:
            a.kind !== "manual" && a.object_id
              ? {
                  kind: a.kind,
                  objectId: a.object_id,
                  budgetType: a.budget_type,
                  amount: a.amount,
                }
              : undefined,
        })),
      });
      return "Audit card displayed to the user (approve buttons attached to executable actions).";
    },
  });

  const renderCampaignCard = betaZodTool({
    name: "render_campaign_card",
    description:
      "Display a campaign draft card (headline stats, settings table, launch button). Use exactly once when proposing a new campaign, grounded in the account's real metrics.",
    inputSchema: z.object({
      intro: z.string().describe("One sentence introducing the draft, **bold** the goal"),
      title: z.string().describe("Campaign name, e.g. 'Acme Store — August Sales Push'"),
      stats: z
        .array(z.object({ label: z.string(), value: z.string(), sub: z.string() }))
        .length(3)
        .describe("Exactly 3: daily budget, est. clicks/mo, est. conversions/mo — sub explains the basis"),
      rows: z
        .array(z.object({ label: z.string(), value: z.string() }))
        .min(3)
        .max(8)
        .describe("Settings table: platform, objective, audience, placements, pixel, landing page…"),
    }),
    run: async (input) => {
      blocks.push({
        type: "campaign",
        intro: input.intro,
        title: input.title,
        stats: input.stats,
        rows: input.rows.map((r) => [r.label, r.value] as [string, string]),
        launchHref: `/dashboard/accounts/${account.rowId}/launch`,
      });
      return "Campaign card displayed to the user (launch button attached).";
    },
  });

  const client = new Anthropic();
  const runner = client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    system: systemPrompt(account),
    tools: [getPerformance, listAdSets, listPixels, renderAuditCard, renderCampaignCard],
    messages: [
      ...opts.history.map((h) => ({
        role: h.role === "agent" ? ("assistant" as const) : ("user" as const),
        content: h.text,
      })),
      { role: "user" as const, content: opts.message },
    ],
  });

  // Each iteration yields an assistant message; its render tools run right
  // after, so text and cards land in conversational order.
  for await (const message of runner) {
    for (const block of message.content) {
      if (block.type === "text" && block.text.trim()) {
        blocks.push({ type: "text", text: block.text.trim() });
      }
    }
  }

  return blocks.length
    ? blocks
    : [{ type: "text", text: "I couldn't produce a response — try rephrasing that." }];
}
