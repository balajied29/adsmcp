import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GraphClient } from "../graph.js";
import type { Config } from "../config.js";
import { isValidAccountId } from "../config.js";
import { compact, errorResult, jsonResult, minorToMajor } from "../format.js";

const STATUS_FILTER = z
  .array(z.enum(["ACTIVE", "PAUSED", "DELETED", "ARCHIVED"]))
  .optional()
  .describe("Only return objects whose effective status is in this list");

const BREAKDOWNS = z
  .array(z.enum(["age", "gender", "publisher_platform", "platform_position", "country"]))
  .optional()
  .describe(
    "Segment metrics by dimension. 'publisher_platform'/'platform_position' cover placement.",
  );

const DATE_PRESETS = z.enum([
  "today",
  "yesterday",
  "last_3d",
  "last_7d",
  "last_14d",
  "last_28d",
  "last_30d",
  "last_90d",
  "this_month",
  "last_month",
  "this_quarter",
  "maximum",
]);

interface RawAction {
  action_type: string;
  value: string;
}

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

function summarizeTargeting(t: Record<string, any> | undefined) {
  if (!t) return undefined;
  return compact({
    countries: t.geo_locations?.countries,
    regions: t.geo_locations?.regions?.map((r: any) => r.name),
    cities: t.geo_locations?.cities?.map((c: any) => c.name),
    age_range:
      t.age_min || t.age_max ? `${t.age_min ?? 18}-${t.age_max ?? 65}` : undefined,
    genders: t.genders?.map((g: number) => (g === 1 ? "male" : "female")),
    interests: t.flexible_spec
      ?.flatMap((s: any) => s.interests ?? [])
      .map((i: any) => i.name),
    custom_audiences: t.custom_audiences?.map((a: any) => a.name ?? a.id),
    publisher_platforms: t.publisher_platforms,
    automatic_placements: t.publisher_platforms ? undefined : true,
  });
}

function summarizeActions(actions: RawAction[] | undefined) {
  if (!actions?.length) return undefined;
  const wanted = new Set([
    "purchase",
    "omni_purchase",
    "offsite_conversion.fb_pixel_purchase",
    "lead",
    "onsite_conversion.lead_grouped",
    "link_click",
    "landing_page_view",
    "add_to_cart",
    "initiate_checkout",
    "complete_registration",
    "mobile_app_install",
    "onsite_conversion.messaging_conversation_started_7d",
  ]);
  const out: Record<string, number> = {};
  for (const a of actions) {
    if (wanted.has(a.action_type)) out[a.action_type] = Number(a.value);
  }
  return Object.keys(out).length ? out : undefined;
}

export function registerReadTools(
  server: McpServer,
  graph: GraphClient,
  config: Config,
): void {
  server.registerTool(
    "list_ad_accounts",
    {
      title: "List ad accounts",
      description:
        "List all Meta ad accounts the access token can see, with id, name, status, currency, and timezone. Read-only.",
      inputSchema: {},
    },
    async () => {
      const accounts = await graph.getAll<any>("me/adaccounts", {
        fields: "id,account_id,name,account_status,currency,timezone_name",
      });
      const STATUS: Record<number, string> = {
        1: "ACTIVE",
        2: "DISABLED",
        3: "UNSETTLED",
        7: "PENDING_RISK_REVIEW",
        8: "PENDING_SETTLEMENT",
        9: "IN_GRACE_PERIOD",
        100: "PENDING_CLOSURE",
        101: "CLOSED",
        201: "ANY_ACTIVE",
        202: "ANY_CLOSED",
      };
      return jsonResult(
        accounts.map((a) =>
          compact({
            id: a.id,
            name: a.name,
            status: STATUS[a.account_status] ?? String(a.account_status),
            currency: a.currency,
            timezone: a.timezone_name,
          }),
        ),
      );
    },
  );

  server.registerTool(
    "list_campaigns",
    {
      title: "List campaigns",
      description:
        "List campaigns in an ad account with id, name, objective, status, and budgets (in currency units, not cents). Read-only.",
      inputSchema: {
        account_id: z
          .string()
          .optional()
          .describe("Ad account id (act_XXXX). Defaults to META_AD_ACCOUNT_ID."),
        status: STATUS_FILTER,
      },
    },
    async ({ account_id, status }) => {
      const acct = resolveAccountId(account_id, config);
      if (!acct.ok) return errorResult(acct.message);

      const params: Record<string, string> = {
        fields:
          "id,name,objective,status,effective_status,daily_budget,lifetime_budget,buying_type,special_ad_categories,created_time",
        limit: "100",
      };
      if (status?.length) params.effective_status = JSON.stringify(status);

      const campaigns = await graph.getAll<any>(`${acct.id}/campaigns`, params);
      return jsonResult(
        campaigns.map((c) =>
          compact({
            id: c.id,
            name: c.name,
            objective: c.objective,
            status: c.effective_status ?? c.status,
            daily_budget: minorToMajor(c.daily_budget),
            lifetime_budget: minorToMajor(c.lifetime_budget),
            buying_type: c.buying_type,
            special_ad_categories: c.special_ad_categories,
            created_time: c.created_time,
          }),
        ),
      );
    },
  );

  server.registerTool(
    "list_adsets",
    {
      title: "List ad sets",
      description:
        "List ad sets in a campaign with targeting summary, budget (currency units), schedule, optimization goal, and status. Read-only.",
      inputSchema: {
        campaign_id: z.string().describe("Campaign id"),
        status: STATUS_FILTER,
      },
    },
    async ({ campaign_id, status }) => {
      const params: Record<string, string> = {
        fields:
          "id,name,status,effective_status,daily_budget,lifetime_budget,billing_event,optimization_goal,bid_strategy,targeting,start_time,end_time",
        limit: "100",
      };
      if (status?.length) params.effective_status = JSON.stringify(status);

      const adsets = await graph.getAll<any>(`${campaign_id}/adsets`, params);
      return jsonResult(
        adsets.map((s) =>
          compact({
            id: s.id,
            name: s.name,
            status: s.effective_status ?? s.status,
            daily_budget: minorToMajor(s.daily_budget),
            lifetime_budget: minorToMajor(s.lifetime_budget),
            billing_event: s.billing_event,
            optimization_goal: s.optimization_goal,
            bid_strategy: s.bid_strategy,
            targeting: summarizeTargeting(s.targeting),
            start_time: s.start_time,
            end_time: s.end_time,
          }),
        ),
      );
    },
  );

  server.registerTool(
    "list_ads",
    {
      title: "List ads",
      description:
        "List ads in an ad set with id, name, status, and creative name/id. Read-only.",
      inputSchema: {
        adset_id: z.string().describe("Ad set id"),
        status: STATUS_FILTER,
      },
    },
    async ({ adset_id, status }) => {
      const params: Record<string, string> = {
        fields: "id,name,status,effective_status,creative{id,name}",
        limit: "100",
      };
      if (status?.length) params.effective_status = JSON.stringify(status);

      const ads = await graph.getAll<any>(`${adset_id}/ads`, params);
      return jsonResult(
        ads.map((a) =>
          compact({
            id: a.id,
            name: a.name,
            status: a.effective_status ?? a.status,
            creative_id: a.creative?.id,
            creative_name: a.creative?.name,
          }),
        ),
      );
    },
  );

  server.registerTool(
    "get_insights",
    {
      title: "Get performance insights",
      description:
        "Fetch performance metrics (spend, impressions, clicks, CTR, CPC, CPM, reach, frequency, conversions, ROAS when available) for an account, campaign, ad set, or ad. Supports date presets or a custom since/until range and breakdowns by age, gender, placement, or country. Read-only.",
      inputSchema: {
        object_id: z
          .string()
          .optional()
          .describe(
            "Id of the account (act_XXXX), campaign, ad set, or ad to report on. Defaults to META_AD_ACCOUNT_ID.",
          ),
        level: z
          .enum(["account", "campaign", "adset", "ad"])
          .default("campaign")
          .describe("Aggregation level of the result rows"),
        date_preset: DATE_PRESETS.optional().describe(
          "Relative date range. Ignored when since/until are set.",
        ),
        since: z.string().optional().describe("Start date, YYYY-MM-DD"),
        until: z.string().optional().describe("End date, YYYY-MM-DD"),
        breakdowns: BREAKDOWNS,
      },
    },
    async ({ object_id, level, date_preset, since, until, breakdowns }) => {
      let id = object_id;
      if (!id || isValidAccountId(id)) {
        const acct = resolveAccountId(id, config);
        if (!acct.ok) return errorResult(acct.message);
        id = acct.id;
      }
      if ((since && !until) || (!since && until)) {
        return errorResult("Provide both since and until, or neither.");
      }

      const params: Record<string, string> = {
        level,
        fields:
          "campaign_name,adset_name,ad_name,spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,purchase_roas",
        limit: "100",
      };
      if (since && until) {
        params.time_range = JSON.stringify({ since, until });
      } else {
        params.date_preset = date_preset ?? "last_30d";
      }
      if (breakdowns?.length) params.breakdowns = breakdowns.join(",");

      const rows = await graph.getAll<any>(`${id}/insights`, params);
      if (!rows.length) {
        return jsonResult({ message: "No insights for this range.", rows: [] });
      }
      return jsonResult(
        rows.map((r) =>
          compact({
            campaign: r.campaign_name,
            adset: r.adset_name,
            ad: r.ad_name,
            date_start: r.date_start,
            date_stop: r.date_stop,
            age: r.age,
            gender: r.gender,
            placement:
              r.publisher_platform &&
              [r.publisher_platform, r.platform_position].filter(Boolean).join("/"),
            country: r.country,
            spend: r.spend !== undefined ? Number(r.spend) : undefined,
            impressions: r.impressions !== undefined ? Number(r.impressions) : undefined,
            clicks: r.clicks !== undefined ? Number(r.clicks) : undefined,
            ctr: r.ctr !== undefined ? Number(r.ctr) : undefined,
            cpc: r.cpc !== undefined ? Number(r.cpc) : undefined,
            cpm: r.cpm !== undefined ? Number(r.cpm) : undefined,
            reach: r.reach !== undefined ? Number(r.reach) : undefined,
            frequency: r.frequency !== undefined ? Number(r.frequency) : undefined,
            conversions: summarizeActions(r.actions),
            roas: r.purchase_roas?.[0]?.value
              ? Number(r.purchase_roas[0].value)
              : undefined,
          }),
        ),
      );
    },
  );

  server.registerTool(
    "get_ad_creative",
    {
      title: "Get ad creative details",
      description:
        "Fetch the creative behind an ad: headline, body text, link, call to action, and image/video ids. Read-only.",
      inputSchema: {
        ad_id: z.string().describe("Ad id"),
      },
    },
    async ({ ad_id }) => {
      const ad = await graph.get<any>(ad_id, {
        fields:
          "id,name,creative{id,name,title,body,object_story_spec,image_hash,image_url,thumbnail_url,video_id,link_url,call_to_action_type,instagram_permalink_url}",
      });
      const c = ad.creative ?? {};
      const link = c.object_story_spec?.link_data;
      const video = c.object_story_spec?.video_data;
      return jsonResult(
        compact({
          ad_id: ad.id,
          ad_name: ad.name,
          creative_id: c.id,
          creative_name: c.name,
          headline: c.title ?? link?.name ?? video?.title,
          body: c.body ?? link?.message ?? video?.message,
          link: c.link_url ?? link?.link ?? video?.call_to_action?.value?.link,
          call_to_action:
            c.call_to_action_type ??
            link?.call_to_action?.type ??
            video?.call_to_action?.type,
          image_hash: c.image_hash ?? link?.image_hash,
          image_url: c.image_url ?? c.thumbnail_url,
          video_id: c.video_id ?? video?.video_id,
          page_id: c.object_story_spec?.page_id,
          instagram_permalink: c.instagram_permalink_url,
        }),
      );
    },
  );
}
