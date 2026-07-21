import { NextResponse, type NextRequest } from "next/server";
import { resolveMcpKey, type McpContext } from "@/lib/mcp-auth";

/**
 * Hosted MCP connector (Streamable HTTP, stateless JSON responses).
 * Register in Claude Code:
 *   claude mcp add aps --transport http {APP_URL}/api/mcp \
 *     --header "Authorization: Bearer aps_..."
 * Reads are unrestricted; writes go through the same guardrails as the UI
 * (5x budget rule with confirm_large_change escape hatch).
 */

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

const PROTOCOL_VERSION = "2025-03-26";

const TOOLS = [
  {
    name: "list_ad_accounts",
    description: "List the Meta ad accounts connected to this AP/S workspace.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_campaigns",
    description:
      "List campaigns for an ad account with budgets (currency units) and status.",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "act_XXXX; defaults to the first account" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_adsets",
    description: "List ad sets in a campaign with targeting summary, budget, schedule.",
    inputSchema: {
      type: "object",
      properties: { campaign_id: { type: "string" } },
      required: ["campaign_id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_ads",
    description: "List ads in an ad set with creative name and status.",
    inputSchema: {
      type: "object",
      properties: { adset_id: { type: "string" } },
      required: ["adset_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_insights",
    description:
      "Performance metrics (spend, CTR, CPC, CPM, reach, frequency, conversions, ROAS) for an account, campaign, ad set, or ad.",
    inputSchema: {
      type: "object",
      properties: {
        object_id: { type: "string", description: "Defaults to the first ad account" },
        level: { type: "string", enum: ["account", "campaign", "adset", "ad"] },
        date_preset: {
          type: "string",
          enum: ["today", "yesterday", "last_7d", "last_14d", "last_30d", "last_90d", "this_month", "last_month"],
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "update_status",
    description:
      "WRITE: Pause or resume a campaign, ad set, or ad. ACTIVE resumes real ad spend.",
    inputSchema: {
      type: "object",
      properties: {
        object_id: { type: "string" },
        status: { type: "string", enum: ["ACTIVE", "PAUSED"] },
      },
      required: ["object_id", "status"],
      additionalProperties: false,
    },
  },
  {
    name: "update_budget",
    description:
      "WRITE: Change a daily or lifetime budget (currency units). Increases beyond 5x the current budget are rejected unless confirm_large_change is true.",
    inputSchema: {
      type: "object",
      properties: {
        object_id: { type: "string" },
        budget_type: { type: "string", enum: ["daily", "lifetime"] },
        amount: { type: "number", exclusiveMinimum: 0 },
        confirm_large_change: { type: "boolean", default: false },
      },
      required: ["object_id", "budget_type", "amount"],
      additionalProperties: false,
    },
  },
] as const;

function textResult(value: unknown, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    ...(isError && { isError: true }),
  };
}

async function callTool(
  ctx: McpContext,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const first = ctx.accounts[0]!;
  switch (name) {
    case "list_ad_accounts":
      return textResult(ctx.accounts.map(({ accountId, name: n, currency }) => ({ id: accountId, name: n, currency })));
    case "list_campaigns":
      return textResult(await ctx.meta.listCampaigns((args.account_id as string) ?? first.accountId));
    case "list_adsets":
      return textResult(await ctx.meta.listAdSets(String(args.campaign_id)));
    case "list_ads":
      return textResult(await ctx.meta.listAds(String(args.adset_id)));
    case "get_insights":
      return textResult(
        await ctx.meta.getInsights((args.object_id as string) ?? first.accountId, {
          level: (args.level as never) ?? "campaign",
          datePreset: (args.date_preset as never) ?? "last_30d",
        }),
      );
    case "update_status": {
      await ctx.meta.updateStatus(String(args.object_id), args.status as "ACTIVE" | "PAUSED");
      return textResult({ ok: true, status: args.status });
    }
    case "update_budget": {
      const type = args.budget_type as "daily" | "lifetime";
      const amount = Number(args.amount);
      const current = await ctx.meta.getBudget(String(args.object_id));
      const cur = type === "daily" ? current.daily : current.lifetime;
      if (cur === undefined) {
        return textResult({ error: `"${current.name}" has no ${type} budget set.` }, true);
      }
      if (amount > cur * 5 && !args.confirm_large_change) {
        return textResult(
          {
            error: `Refusing to raise the ${type} budget from ${cur} to ${amount} (more than 5x). Pass confirm_large_change: true if intentional.`,
          },
          true,
        );
      }
      await ctx.meta.updateBudget(String(args.object_id), type, amount);
      return textResult({ ok: true, previous: cur, new: amount });
    }
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
  }
}

export async function POST(request: NextRequest) {
  let ctx: McpContext | null = null;
  try {
    ctx = await resolveMcpKey(request.headers.get("authorization"));
  } catch {
    ctx = null; // resolution failures read as auth failures, not 500s
  }
  if (!ctx) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Invalid or missing bearer key" } },
      { status: 401 },
    );
  }

  let msg: JsonRpcRequest;
  try {
    msg = (await request.json()) as JsonRpcRequest;
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 },
    );
  }

  // Notifications (no id) are acknowledged with 202.
  if (msg.id === undefined || msg.id === null) {
    return new NextResponse(null, { status: 202 });
  }

  const reply = (result: unknown) =>
    NextResponse.json({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code: number, message: string, status = 200) =>
    NextResponse.json({ jsonrpc: "2.0", id: msg.id, error: { code, message } }, { status });

  try {
    switch (msg.method) {
      case "initialize":
        return reply({
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "aps", version: "1.0.0" },
        });
      case "ping":
        return reply({});
      case "tools/list":
        return reply({ tools: TOOLS });
      case "tools/call": {
        const { name, arguments: args } = (msg.params ?? {}) as {
          name?: string;
          arguments?: Record<string, unknown>;
        };
        if (!name) return fail(-32602, "tools/call needs params.name");
        try {
          return reply(await callTool(ctx, name, args ?? {}));
        } catch (err) {
          // Tool-level failures come back as tool results, not protocol errors.
          const m = err instanceof Error ? ctx.meta.graph.redact(err.message) : "Tool failed";
          return reply(textResult({ error: m }, true));
        }
      }
      default:
        return fail(-32601, `Method not found: ${msg.method}`);
    }
  } catch (err) {
    return fail(-32603, err instanceof Error ? err.message : "Internal error", 500);
  }
}

// Streamable HTTP allows servers without an SSE stream; reject GET politely.
export function GET() {
  return NextResponse.json(
    { error: "SSE stream not supported; POST JSON-RPC messages." },
    { status: 405 },
  );
}
