/**
 * Typed high-level Meta Marketing API client, shared by the web app and the
 * worker. One instance per connected tenant token.
 */
import { GraphClient } from "./graph.js";
import { LaunchClient } from "./launch.js";
import type {
  Ad,
  AdAccount,
  AdSet,
  Campaign,
  InsightRow,
  InsightsOptions,
} from "./types.js";

export { GraphClient, GraphApiError } from "./graph.js";
export * from "./types.js";
export * from "./launch.js";

export const DEFAULT_API_VERSION = "v25.0";

const ACCOUNT_STATUS: Record<number, string> = {
  1: "ACTIVE",
  2: "DISABLED",
  3: "UNSETTLED",
  7: "PENDING_RISK_REVIEW",
  8: "PENDING_SETTLEMENT",
  9: "IN_GRACE_PERIOD",
  100: "PENDING_CLOSURE",
  101: "CLOSED",
};

export function minorToMajor(minor: string | number | undefined): number | undefined {
  if (minor === undefined || minor === null || minor === "") return undefined;
  const n = typeof minor === "string" ? Number(minor) : minor;
  return Number.isNaN(n) ? undefined : n / 100;
}

export function majorToMinor(major: number): string {
  return String(Math.round(major * 100));
}

const num = (v: unknown): number | undefined =>
  v === undefined || v === null ? undefined : Number(v);

const CONVERSION_ACTIONS = new Set([
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
]);

export class MetaAdsClient {
  readonly graph: GraphClient;
  readonly launch: LaunchClient;

  constructor(accessToken: string, apiVersion: string = DEFAULT_API_VERSION) {
    this.graph = new GraphClient(accessToken, apiVersion);
    this.launch = new LaunchClient(this.graph);
  }

  async listAdAccounts(): Promise<AdAccount[]> {
    const rows = await this.graph.getAll<any>("me/adaccounts", {
      fields: "id,name,account_status,currency,timezone_name",
    });
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      status: ACCOUNT_STATUS[a.account_status] ?? String(a.account_status),
      currency: a.currency,
      timezone: a.timezone_name,
    }));
  }

  async listCampaigns(accountId: string, statuses?: string[]): Promise<Campaign[]> {
    const params: Record<string, string> = {
      fields:
        "id,name,objective,status,effective_status,daily_budget,lifetime_budget,buying_type,created_time",
      limit: "100",
    };
    if (statuses?.length) params.effective_status = JSON.stringify(statuses);
    const rows = await this.graph.getAll<any>(`${accountId}/campaigns`, params);
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      objective: c.objective,
      status: c.effective_status ?? c.status,
      dailyBudget: minorToMajor(c.daily_budget),
      lifetimeBudget: minorToMajor(c.lifetime_budget),
      buyingType: c.buying_type,
      createdTime: c.created_time,
    }));
  }

  async listAdSets(campaignId: string): Promise<AdSet[]> {
    const rows = await this.graph.getAll<any>(`${campaignId}/adsets`, {
      fields:
        "id,name,status,effective_status,daily_budget,lifetime_budget,billing_event,optimization_goal,targeting,start_time,end_time",
      limit: "100",
    });
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.effective_status ?? s.status,
      dailyBudget: minorToMajor(s.daily_budget),
      lifetimeBudget: minorToMajor(s.lifetime_budget),
      billingEvent: s.billing_event,
      optimizationGoal: s.optimization_goal,
      targetingSummary: summarizeTargeting(s.targeting),
      startTime: s.start_time,
      endTime: s.end_time,
    }));
  }

  async listAds(adsetId: string): Promise<Ad[]> {
    const rows = await this.graph.getAll<any>(`${adsetId}/ads`, {
      fields: "id,name,status,effective_status,creative{id,name}",
      limit: "100",
    });
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.effective_status ?? a.status,
      creativeId: a.creative?.id,
      creativeName: a.creative?.name,
    }));
  }

  async getInsights(objectId: string, opts: InsightsOptions = {}): Promise<InsightRow[]> {
    const params: Record<string, string> = {
      level: opts.level ?? "campaign",
      fields:
        "campaign_name,adset_name,ad_name,spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,purchase_roas",
      limit: "100",
    };
    if (opts.since && opts.until) {
      params.time_range = JSON.stringify({ since: opts.since, until: opts.until });
    } else {
      params.date_preset = opts.datePreset ?? "last_30d";
    }
    if (opts.breakdowns?.length) params.breakdowns = opts.breakdowns.join(",");

    const rows = await this.graph.getAll<any>(`${objectId}/insights`, params);
    return rows.map((r) => ({
      campaign: r.campaign_name,
      adset: r.adset_name,
      ad: r.ad_name,
      dateStart: r.date_start,
      dateStop: r.date_stop,
      age: r.age,
      gender: r.gender,
      placement:
        r.publisher_platform &&
        [r.publisher_platform, r.platform_position].filter(Boolean).join("/"),
      country: r.country,
      spend: num(r.spend),
      impressions: num(r.impressions),
      clicks: num(r.clicks),
      ctr: num(r.ctr),
      cpc: num(r.cpc),
      cpm: num(r.cpm),
      reach: num(r.reach),
      frequency: num(r.frequency),
      conversions: summarizeActions(r.actions),
      roas: r.purchase_roas?.[0]?.value ? Number(r.purchase_roas[0].value) : undefined,
    }));
  }

  // --- Write operations (guardrails are enforced by the caller, not here) ---

  async updateStatus(objectId: string, status: "ACTIVE" | "PAUSED"): Promise<void> {
    await this.graph.post(objectId, { status });
  }

  async getBudget(
    objectId: string,
  ): Promise<{ id: string; name: string; daily?: number; lifetime?: number }> {
    const o = await this.graph.get<any>(objectId, {
      fields: "id,name,daily_budget,lifetime_budget",
    });
    return {
      id: o.id,
      name: o.name,
      daily: minorToMajor(o.daily_budget),
      lifetime: minorToMajor(o.lifetime_budget),
    };
  }

  async updateBudget(
    objectId: string,
    type: "daily" | "lifetime",
    amountMajor: number,
  ): Promise<void> {
    const field = type === "daily" ? "daily_budget" : "lifetime_budget";
    await this.graph.post(objectId, { [field]: majorToMinor(amountMajor) });
  }
}

function summarizeTargeting(t: Record<string, any> | undefined) {
  if (!t) return undefined;
  const out: Record<string, unknown> = {};
  if (t.geo_locations?.countries) out.countries = t.geo_locations.countries;
  if (t.age_min || t.age_max) out.ageRange = `${t.age_min ?? 18}-${t.age_max ?? 65}`;
  if (t.genders) out.genders = t.genders.map((g: number) => (g === 1 ? "male" : "female"));
  const interests = t.flexible_spec
    ?.flatMap((s: any) => s.interests ?? [])
    .map((i: any) => i.name);
  if (interests?.length) out.interests = interests;
  if (t.publisher_platforms) out.platforms = t.publisher_platforms;
  return Object.keys(out).length ? out : undefined;
}

function summarizeActions(
  actions: { action_type: string; value: string }[] | undefined,
): Record<string, number> | undefined {
  if (!actions?.length) return undefined;
  const out: Record<string, number> = {};
  for (const a of actions) {
    if (CONVERSION_ACTIONS.has(a.action_type)) out[a.action_type] = Number(a.value);
  }
  return Object.keys(out).length ? out : undefined;
}

// --- OAuth helpers (used by the web app's connect flow) ---

export interface TokenExchangeResult {
  accessToken: string;
  expiresInSeconds?: number;
}

/** Exchange the OAuth redirect `code` for a short-lived user token. */
export async function exchangeCodeForToken(
  appId: string,
  appSecret: string,
  redirectUri: string,
  code: string,
  apiVersion: string = DEFAULT_API_VERSION,
): Promise<TokenExchangeResult> {
  const url = new URL(`https://graph.facebook.com/${apiVersion}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);
  const res = await fetch(url);
  const json: any = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(
      `OAuth code exchange failed: ${json?.error?.message ?? res.statusText}`,
    );
  }
  return { accessToken: json.access_token, expiresInSeconds: json.expires_in };
}

/** Exchange a short-lived user token for a long-lived (~60 day) one. */
export async function exchangeForLongLivedToken(
  appId: string,
  appSecret: string,
  shortLivedToken: string,
  apiVersion: string = DEFAULT_API_VERSION,
): Promise<TokenExchangeResult> {
  const url = new URL(`https://graph.facebook.com/${apiVersion}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);
  const res = await fetch(url);
  const json: any = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Long-lived token exchange failed: ${json?.error?.message ?? res.statusText}`,
    );
  }
  return { accessToken: json.access_token, expiresInSeconds: json.expires_in };
}

/** Build the Facebook Login dialog URL for the connect flow. */
export function buildOAuthDialogUrl(
  appId: string,
  redirectUri: string,
  state: string,
  apiVersion: string = DEFAULT_API_VERSION,
): string {
  const url = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "ads_read,ads_management,business_management");
  url.searchParams.set("response_type", "code");
  return url.toString();
}
