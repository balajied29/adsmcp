import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GraphClient } from "../graph.js";
import type { Config } from "../config.js";
import { isValidAccountId } from "../config.js";
import { compact, errorResult, jsonResult, majorToMinor, minorToMajor } from "../format.js";

const OBJECTIVES = z.enum([
  "OUTCOME_AWARENESS",
  "OUTCOME_TRAFFIC",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_LEADS",
  "OUTCOME_APP_PROMOTION",
  "OUTCOME_SALES",
]);

const SPECIAL_AD_CATEGORIES = z.enum([
  "NONE",
  "EMPLOYMENT",
  "HOUSING",
  "CREDIT",
  "ISSUES_ELECTIONS_POLITICS",
  "FINANCIAL_PRODUCTS_SERVICES",
]);

const BILLING_EVENTS = z.enum(["IMPRESSIONS", "LINK_CLICKS", "THRUPLAY"]);

const OPTIMIZATION_GOALS = z.enum([
  "REACH",
  "IMPRESSIONS",
  "LINK_CLICKS",
  "LANDING_PAGE_VIEWS",
  "OFFSITE_CONVERSIONS",
  "LEAD_GENERATION",
  "THRUPLAY",
  "POST_ENGAGEMENT",
  "PAGE_LIKES",
  "APP_INSTALLS",
  "CONVERSATIONS",
  "QUALITY_LEAD",
  "VALUE",
]);

function resolveAccountId(
  accountId: string | undefined,
  config: Config,
): { ok: true; id: string } | { ok: false; message: string } {
  const id = accountId ?? config.defaultAdAccountId;
  if (!id) {
    return {
      ok: false,
      message:
        "No ad account id given and META_AD_ACCOUNT_ID is not set. Pass account_id (format act_1234567890) or set the env var.",
    };
  }
  if (!isValidAccountId(id)) {
    return {
      ok: false,
      message: `Invalid ad account id "${id}" — must match act_<digits>, e.g. act_1234567890.`,
    };
  }
  return { ok: true, id };
}

export function registerWriteTools(
  server: McpServer,
  graph: GraphClient,
  config: Config,
): void {
  server.registerTool(
    "create_campaign",
    {
      title: "Create campaign",
      description:
        "WRITE: Creates a new campaign in the ad account. Created PAUSED by default — it will not spend money unless status is explicitly set to ACTIVE. Budgets are set on ad sets (or pass a campaign-level daily/lifetime budget here for CBO).",
      inputSchema: {
        name: z.string().min(1).describe("Campaign name"),
        objective: OBJECTIVES.describe("Campaign objective (OUTCOME_* values)"),
        account_id: z
          .string()
          .optional()
          .describe("Ad account id (act_XXXX). Defaults to META_AD_ACCOUNT_ID."),
        status: z
          .enum(["PAUSED", "ACTIVE"])
          .default("PAUSED")
          .describe("PAUSED (default, safe) or ACTIVE (starts delivery/spend)"),
        buying_type: z.enum(["AUCTION", "RESERVED"]).default("AUCTION"),
        special_ad_categories: z
          .array(SPECIAL_AD_CATEGORIES)
          .default([])
          .describe("Required by Meta for regulated verticals; [] means none"),
        daily_budget: z
          .number()
          .positive()
          .optional()
          .describe("Optional campaign-level (CBO) daily budget in currency units"),
        lifetime_budget: z
          .number()
          .positive()
          .optional()
          .describe("Optional campaign-level (CBO) lifetime budget in currency units"),
      },
    },
    async ({
      name,
      objective,
      account_id,
      status,
      buying_type,
      special_ad_categories,
      daily_budget,
      lifetime_budget,
    }) => {
      const acct = resolveAccountId(account_id, config);
      if (!acct.ok) return errorResult(acct.message);
      if (daily_budget && lifetime_budget) {
        return errorResult("Set either daily_budget or lifetime_budget, not both.");
      }

      const params: Record<string, string> = {
        name,
        objective,
        status,
        buying_type,
        special_ad_categories: JSON.stringify(
          special_ad_categories.filter((c) => c !== "NONE"),
        ),
      };
      if (daily_budget) params.daily_budget = majorToMinor(daily_budget);
      if (lifetime_budget) params.lifetime_budget = majorToMinor(lifetime_budget);

      const res = await graph.post<{ id: string }>(`${acct.id}/campaigns`, params);
      return jsonResult({
        campaign_id: res.id,
        status,
        note:
          status === "PAUSED"
            ? "Campaign created PAUSED — no spend until you activate it."
            : "Campaign created ACTIVE — it can begin spending once it has active ad sets and ads.",
      });
    },
  );

  server.registerTool(
    "create_adset",
    {
      title: "Create ad set",
      description:
        "WRITE: Creates a new ad set in a campaign, with budget, schedule, and targeting. Created PAUSED by default — it will not spend money unless status is explicitly set to ACTIVE. Budgets are given in currency units (e.g. 25.50 = $25.50), converted to Meta's minor units internally.",
      inputSchema: {
        campaign_id: z.string().describe("Parent campaign id"),
        name: z.string().min(1).describe("Ad set name"),
        account_id: z
          .string()
          .optional()
          .describe("Ad account id (act_XXXX). Defaults to META_AD_ACCOUNT_ID."),
        daily_budget: z
          .number()
          .positive()
          .optional()
          .describe("Daily budget in currency units (set this or lifetime_budget)"),
        lifetime_budget: z
          .number()
          .positive()
          .optional()
          .describe("Lifetime budget in currency units (requires end_time)"),
        billing_event: BILLING_EVENTS.default("IMPRESSIONS"),
        optimization_goal: OPTIMIZATION_GOALS.default("LINK_CLICKS"),
        countries: z
          .array(z.string().length(2))
          .default(["US"])
          .describe("ISO country codes for geo targeting, e.g. ['US','CA']"),
        age_min: z.number().int().min(18).max(65).default(18),
        age_max: z.number().int().min(18).max(65).default(65),
        genders: z
          .enum(["all", "male", "female"])
          .default("all")
          .describe("Gender targeting"),
        interest_ids: z
          .array(z.string())
          .optional()
          .describe("Meta interest ids for detailed targeting (optional)"),
        start_time: z
          .string()
          .optional()
          .describe("Schedule start, ISO 8601 (e.g. 2026-08-01T00:00:00-0700)"),
        end_time: z
          .string()
          .optional()
          .describe("Schedule end, ISO 8601. Required with lifetime_budget."),
        status: z
          .enum(["PAUSED", "ACTIVE"])
          .default("PAUSED")
          .describe("PAUSED (default, safe) or ACTIVE (starts delivery/spend)"),
      },
    },
    async (args) => {
      const acct = resolveAccountId(args.account_id, config);
      if (!acct.ok) return errorResult(acct.message);

      const hasDaily = args.daily_budget !== undefined;
      const hasLifetime = args.lifetime_budget !== undefined;
      if (hasDaily === hasLifetime) {
        return errorResult("Set exactly one of daily_budget or lifetime_budget.");
      }
      if (hasLifetime && !args.end_time) {
        return errorResult("lifetime_budget requires end_time.");
      }
      if (args.age_min > args.age_max) {
        return errorResult("age_min cannot be greater than age_max.");
      }

      const targeting: Record<string, unknown> = {
        geo_locations: { countries: args.countries },
        age_min: args.age_min,
        age_max: args.age_max,
      };
      if (args.genders !== "all") {
        targeting.genders = [args.genders === "male" ? 1 : 2];
      }
      if (args.interest_ids?.length) {
        targeting.flexible_spec = [
          { interests: args.interest_ids.map((id) => ({ id })) },
        ];
      }

      const params: Record<string, string> = {
        campaign_id: args.campaign_id,
        name: args.name,
        billing_event: args.billing_event,
        optimization_goal: args.optimization_goal,
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        targeting: JSON.stringify(targeting),
        status: args.status,
      };
      if (args.daily_budget) params.daily_budget = majorToMinor(args.daily_budget);
      if (args.lifetime_budget)
        params.lifetime_budget = majorToMinor(args.lifetime_budget);
      if (args.start_time) params.start_time = args.start_time;
      if (args.end_time) params.end_time = args.end_time;

      const res = await graph.post<{ id: string }>(`${acct.id}/adsets`, params);
      return jsonResult({
        adset_id: res.id,
        status: args.status,
        note:
          args.status === "PAUSED"
            ? "Ad set created PAUSED — no spend until you activate it."
            : "Ad set created ACTIVE — it can spend once it contains active ads.",
      });
    },
  );

  server.registerTool(
    "update_status",
    {
      title: "Pause or resume a campaign, ad set, or ad",
      description:
        "WRITE: Changes the status of a campaign, ad set, or ad. Setting ACTIVE resumes delivery and real ad spend; setting PAUSED stops delivery.",
      inputSchema: {
        object_id: z.string().describe("Campaign, ad set, or ad id"),
        status: z
          .enum(["ACTIVE", "PAUSED"])
          .describe("ACTIVE resumes delivery (spend); PAUSED stops it"),
      },
    },
    async ({ object_id, status }) => {
      await graph.post<{ success: boolean }>(object_id, { status });
      const obj = await graph.get<any>(object_id, {
        fields: "id,name,status,effective_status",
      });
      return jsonResult({
        id: obj.id,
        name: obj.name,
        status: obj.status,
        effective_status: obj.effective_status,
      });
    },
  );

  server.registerTool(
    "update_budget",
    {
      title: "Update budget",
      description:
        "WRITE: Changes the daily or lifetime budget of a campaign or ad set, in currency units. This directly affects real ad spend. Increases of more than 5x the current budget are rejected unless confirm_large_change is true.",
      inputSchema: {
        object_id: z.string().describe("Campaign or ad set id"),
        budget_type: z.enum(["daily", "lifetime"]),
        amount: z
          .number()
          .positive()
          .describe("New budget in currency units (e.g. 50 = $50.00)"),
        confirm_large_change: z
          .boolean()
          .default(false)
          .describe("Must be true to allow an increase of more than 5x the current budget"),
      },
    },
    async ({ object_id, budget_type, amount, confirm_large_change }) => {
      const field = budget_type === "daily" ? "daily_budget" : "lifetime_budget";

      const current = await graph.get<any>(object_id, {
        fields: "id,name,daily_budget,lifetime_budget",
      });
      const currentMajor = minorToMajor(current[field]);

      if (currentMajor === undefined) {
        return errorResult(
          `"${current.name}" has no ${budget_type} budget set. It may use the other budget type or inherit a campaign-level (CBO) budget — check with list_campaigns/list_adsets first.`,
        );
      }
      if (amount > currentMajor * 5 && !confirm_large_change) {
        return errorResult(
          `Refusing to raise the ${budget_type} budget from ${currentMajor} to ${amount} (more than 5x). ` +
            "If this is intentional, call again with confirm_large_change: true.",
        );
      }

      await graph.post<{ success: boolean }>(object_id, {
        [field]: majorToMinor(amount),
      });
      return jsonResult({
        id: current.id,
        name: current.name,
        budget_type,
        previous: currentMajor,
        new: amount,
      });
    },
  );

  server.registerTool(
    "create_ad",
    {
      title: "Create ad",
      description:
        "WRITE: Creates a new ad in an ad set, either from an existing creative (creative_id) or a new link ad creative (page_id + message + link, optionally image_hash). Created PAUSED by default — it will not deliver or spend unless status is explicitly set to ACTIVE.",
      inputSchema: {
        adset_id: z.string().describe("Parent ad set id"),
        name: z.string().min(1).describe("Ad name"),
        account_id: z
          .string()
          .optional()
          .describe("Ad account id (act_XXXX). Defaults to META_AD_ACCOUNT_ID."),
        creative_id: z
          .string()
          .optional()
          .describe("Reuse an existing creative by id (skips the fields below)"),
        page_id: z
          .string()
          .optional()
          .describe("Facebook Page the ad runs from (required when building a new creative)"),
        message: z.string().optional().describe("Primary ad text"),
        link: z.string().url().optional().describe("Destination URL"),
        headline: z.string().optional().describe("Ad headline (link name)"),
        image_hash: z
          .string()
          .optional()
          .describe("Hash of an image already uploaded to the account's image library"),
        call_to_action: z
          .enum(["LEARN_MORE", "SHOP_NOW", "SIGN_UP", "SUBSCRIBE", "CONTACT_US", "DOWNLOAD", "GET_OFFER", "BOOK_TRAVEL"])
          .optional(),
        status: z
          .enum(["PAUSED", "ACTIVE"])
          .default("PAUSED")
          .describe("PAUSED (default, safe) or ACTIVE (starts delivery/spend)"),
      },
    },
    async (args) => {
      const acct = resolveAccountId(args.account_id, config);
      if (!acct.ok) return errorResult(acct.message);

      let creative: Record<string, unknown>;
      if (args.creative_id) {
        creative = { creative_id: args.creative_id };
      } else {
        if (!args.page_id || !args.message || !args.link) {
          return errorResult(
            "To build a new creative, provide page_id, message, and link (image_hash optional). Or pass creative_id to reuse an existing creative.",
          );
        }
        const linkData: Record<string, unknown> = {
          message: args.message,
          link: args.link,
        };
        if (args.headline) linkData.name = args.headline;
        if (args.image_hash) linkData.image_hash = args.image_hash;
        if (args.call_to_action) {
          linkData.call_to_action = {
            type: args.call_to_action,
            value: { link: args.link },
          };
        }
        creative = {
          object_story_spec: { page_id: args.page_id, link_data: linkData },
        };
      }

      const res = await graph.post<{ id: string }>(`${acct.id}/ads`, {
        name: args.name,
        adset_id: args.adset_id,
        creative: JSON.stringify(creative),
        status: args.status,
      });
      return jsonResult({
        ad_id: res.id,
        status: args.status,
        note:
          args.status === "PAUSED"
            ? "Ad created PAUSED — no delivery or spend until you activate it."
            : "Ad created ACTIVE — it will deliver once it passes Meta's ad review.",
      });
    },
  );
}
