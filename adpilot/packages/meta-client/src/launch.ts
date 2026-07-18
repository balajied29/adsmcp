/**
 * Campaign/ad-set/ad creation, audience curation, placements, delivery
 * estimates, pixels, and Conversions API — the "deploy ads" surface.
 */
import { GraphClient } from "./graph.js";
import { majorToMinor } from "./index.js";

// ---------- Placements ----------

export interface PlacementSpec {
  /** Omit or leave empty for Advantage+ (automatic) placements. */
  publisherPlatforms?: ("facebook" | "instagram" | "audience_network" | "messenger")[];
  facebookPositions?: (
    | "feed"
    | "marketplace"
    | "video_feeds"
    | "right_hand_column"
    | "story"
    | "search"
    | "facebook_reels"
  )[];
  instagramPositions?: ("stream" | "story" | "explore" | "reels" | "profile_feed")[];
}

// ---------- Audience ----------

export interface AudienceSpec {
  countries: string[];
  ageMin?: number;
  ageMax?: number;
  genders?: "all" | "male" | "female";
  /** Meta interest ids (from searchInterests). */
  interestIds?: string[];
  /** Existing custom audience ids to include. */
  customAudienceIds?: string[];
  /** Custom audience ids to exclude (e.g. existing customers). */
  excludedCustomAudienceIds?: string[];
}

export function buildTargeting(
  audience: AudienceSpec,
  placements?: PlacementSpec,
): Record<string, unknown> {
  const t: Record<string, unknown> = {
    geo_locations: { countries: audience.countries },
    age_min: audience.ageMin ?? 18,
    age_max: audience.ageMax ?? 65,
  };
  if (audience.genders && audience.genders !== "all") {
    t.genders = [audience.genders === "male" ? 1 : 2];
  }
  if (audience.interestIds?.length) {
    t.flexible_spec = [{ interests: audience.interestIds.map((id) => ({ id })) }];
  }
  if (audience.customAudienceIds?.length) {
    t.custom_audiences = audience.customAudienceIds.map((id) => ({ id }));
  }
  if (audience.excludedCustomAudienceIds?.length) {
    t.excluded_custom_audiences = audience.excludedCustomAudienceIds.map((id) => ({ id }));
  }
  if (placements?.publisherPlatforms?.length) {
    t.publisher_platforms = placements.publisherPlatforms;
    if (placements.facebookPositions?.length) {
      t.facebook_positions = placements.facebookPositions;
    }
    if (placements.instagramPositions?.length) {
      t.instagram_positions = placements.instagramPositions;
    }
  }
  return t;
}

// ---------- Interest search & custom audiences ----------

export interface InterestResult {
  id: string;
  name: string;
  audienceSizeLower?: number;
  audienceSizeUpper?: number;
  path?: string[];
}

export interface CustomAudience {
  id: string;
  name: string;
  subtype?: string;
  approximateCount?: number;
  deliveryStatus?: string;
}

// ---------- Pixels ----------

export interface Pixel {
  id: string;
  name: string;
  lastFiredTime?: string;
  isUnavailable?: boolean;
}

export interface AudienceEstimate {
  monthlyActiveUsersLower?: number;
  monthlyActiveUsersUpper?: number;
  estimateReady: boolean;
}

// ---------- Launch params ----------

export interface LaunchCampaignParams {
  name: string;
  objective:
    | "OUTCOME_AWARENESS"
    | "OUTCOME_TRAFFIC"
    | "OUTCOME_ENGAGEMENT"
    | "OUTCOME_LEADS"
    | "OUTCOME_APP_PROMOTION"
    | "OUTCOME_SALES";
  specialAdCategories?: string[];
  status?: "PAUSED" | "ACTIVE";
}

export interface LaunchAdSetParams {
  campaignId: string;
  name: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  billingEvent?: string;
  optimizationGoal?: string;
  audience: AudienceSpec;
  placements?: PlacementSpec;
  startTime?: string;
  endTime?: string;
  /** Required for conversion goals: which pixel to optimize against. */
  pixelId?: string;
  /** Conversion event, e.g. PURCHASE, LEAD (with pixelId). */
  customEventType?: string;
  status?: "PAUSED" | "ACTIVE";
}

export interface LaunchAdParams {
  adsetId: string;
  name: string;
  creativeId?: string;
  pageId?: string;
  message?: string;
  link?: string;
  headline?: string;
  imageHash?: string;
  callToAction?: string;
  status?: "PAUSED" | "ACTIVE";
}

export class LaunchClient {
  constructor(private readonly graph: GraphClient) {}

  async searchInterests(query: string): Promise<InterestResult[]> {
    const res = await this.graph.get<{ data: any[] }>("search", {
      type: "adinterest",
      q: query,
      limit: "20",
    });
    return (res.data ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      audienceSizeLower: i.audience_size_lower_bound,
      audienceSizeUpper: i.audience_size_upper_bound,
      path: i.path,
    }));
  }

  async listCustomAudiences(accountId: string): Promise<CustomAudience[]> {
    const rows = await this.graph.getAll<any>(`${accountId}/customaudiences`, {
      fields: "id,name,subtype,approximate_count_lower_bound,delivery_status",
      limit: "100",
    });
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      subtype: a.subtype,
      approximateCount: a.approximate_count_lower_bound,
      deliveryStatus: a.delivery_status?.code === 200 ? "ready" : a.delivery_status?.description,
    }));
  }

  async estimateAudience(
    accountId: string,
    audience: AudienceSpec,
    placements?: PlacementSpec,
    optimizationGoal = "LINK_CLICKS",
  ): Promise<AudienceEstimate> {
    const res = await this.graph.get<{ data: any[] }>(`${accountId}/delivery_estimate`, {
      targeting_spec: JSON.stringify(buildTargeting(audience, placements)),
      optimization_goal: optimizationGoal,
    });
    const row = res.data?.[0];
    return {
      monthlyActiveUsersLower: row?.estimate_mau_lower_bound,
      monthlyActiveUsersUpper: row?.estimate_mau_upper_bound,
      estimateReady: Boolean(row?.estimate_ready),
    };
  }

  async listPixels(accountId: string): Promise<Pixel[]> {
    const rows = await this.graph.getAll<any>(`${accountId}/adspixels`, {
      fields: "id,name,last_fired_time,is_unavailable",
      limit: "50",
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      lastFiredTime: p.last_fired_time,
      isUnavailable: p.is_unavailable,
    }));
  }

  /**
   * Send a Conversions API event. With testEventCode set, the event shows in
   * Events Manager -> Test Events instead of production data.
   */
  async sendCapiEvent(
    pixelId: string,
    event: {
      eventName: string;
      eventSourceUrl?: string;
      testEventCode?: string;
      userData?: Record<string, unknown>;
    },
  ): Promise<{ eventsReceived?: number; fbtraceId?: string }> {
    const params: Record<string, string> = {
      data: JSON.stringify([
        {
          event_name: event.eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          event_source_url: event.eventSourceUrl ?? "https://example.com",
          user_data: event.userData ?? {
            client_user_agent: "AdPilot-CAPI-Test/1.0",
          },
        },
      ]),
    };
    if (event.testEventCode) params.test_event_code = event.testEventCode;
    const res = await this.graph.post<any>(`${pixelId}/events`, params);
    return { eventsReceived: res.events_received, fbtraceId: res.fbtrace_id };
  }

  async createCampaign(accountId: string, p: LaunchCampaignParams): Promise<string> {
    const res = await this.graph.post<{ id: string }>(`${accountId}/campaigns`, {
      name: p.name,
      objective: p.objective,
      status: p.status ?? "PAUSED",
      buying_type: "AUCTION",
      special_ad_categories: JSON.stringify(p.specialAdCategories ?? []),
    });
    return res.id;
  }

  async createAdSet(accountId: string, p: LaunchAdSetParams): Promise<string> {
    const params: Record<string, string> = {
      campaign_id: p.campaignId,
      name: p.name,
      billing_event: p.billingEvent ?? "IMPRESSIONS",
      optimization_goal: p.optimizationGoal ?? "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: JSON.stringify(buildTargeting(p.audience, p.placements)),
      status: p.status ?? "PAUSED",
    };
    if (p.dailyBudget) params.daily_budget = majorToMinor(p.dailyBudget);
    if (p.lifetimeBudget) params.lifetime_budget = majorToMinor(p.lifetimeBudget);
    if (p.startTime) params.start_time = p.startTime;
    if (p.endTime) params.end_time = p.endTime;
    if (p.pixelId) {
      params.promoted_object = JSON.stringify({
        pixel_id: p.pixelId,
        custom_event_type: p.customEventType ?? "PURCHASE",
      });
    }
    const res = await this.graph.post<{ id: string }>(`${accountId}/adsets`, params);
    return res.id;
  }

  async createAd(accountId: string, p: LaunchAdParams): Promise<string> {
    let creative: Record<string, unknown>;
    if (p.creativeId) {
      creative = { creative_id: p.creativeId };
    } else {
      if (!p.pageId || !p.message || !p.link) {
        throw new Error("New creative needs pageId, message, and link (or pass creativeId).");
      }
      const linkData: Record<string, unknown> = { message: p.message, link: p.link };
      if (p.headline) linkData.name = p.headline;
      if (p.imageHash) linkData.image_hash = p.imageHash;
      if (p.callToAction) {
        linkData.call_to_action = { type: p.callToAction, value: { link: p.link } };
      }
      creative = { object_story_spec: { page_id: p.pageId, link_data: linkData } };
    }
    const res = await this.graph.post<{ id: string }>(`${accountId}/ads`, {
      name: p.name,
      adset_id: p.adsetId,
      creative: JSON.stringify(creative),
      status: p.status ?? "PAUSED",
    });
    return res.id;
  }

  /**
   * Upload an image to the account's image library. Returns the image_hash
   * used in creatives. `bytesBase64` is the raw file base64-encoded.
   */
  async uploadImage(accountId: string, bytesBase64: string): Promise<string> {
    const res = await this.graph.post<{
      images?: Record<string, { hash?: string }>;
    }>(`${accountId}/adimages`, { bytes: bytesBase64 });
    const hash = res.images ? Object.values(res.images)[0]?.hash : undefined;
    if (!hash) throw new Error("Meta did not return an image hash");
    return hash;
  }

  /** List Facebook Pages the user can run ads from (for the creative step). */
  async listPages(): Promise<{ id: string; name: string }[]> {
    const rows = await this.graph.getAll<any>("me/accounts", {
      fields: "id,name",
      limit: "50",
    });
    return rows.map((p) => ({ id: p.id, name: p.name }));
  }
}
