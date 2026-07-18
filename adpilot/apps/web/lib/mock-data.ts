/**
 * Seeded dummy data for dev login mode. Shapes mirror what Supabase rows and
 * the MetaAdsClient return, so pages render identically to production.
 */
import type {
  Campaign,
  CustomAudience,
  InsightRow,
  InterestResult,
  MetaAdsClient,
  Pixel,
} from "@adpilot/meta-client";

export const MOCK_CONNECTIONS = [
  {
    id: "dev-conn-1",
    fb_user_name: "Dev Meta User",
    token_expires_at: new Date(Date.now() + 55 * 86_400_000).toISOString(),
    created_at: new Date().toISOString(),
  },
];

export const MOCK_ACCOUNTS = [
  {
    id: "dev-acct-1",
    account_id: "act_1234567890",
    name: "Acme Store — Main",
    currency: "USD",
    status: "ACTIVE",
    connection_id: "dev-conn-1",
  },
  {
    id: "dev-acct-2",
    account_id: "act_9876543210",
    name: "Acme Store — EU",
    currency: "EUR",
    status: "ACTIVE",
    connection_id: "dev-conn-1",
  },
];

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: "23850000000000001",
    name: "Summer Sale — Prospecting",
    objective: "OUTCOME_SALES",
    status: "ACTIVE",
    dailyBudget: 80,
    buyingType: "AUCTION",
    createdTime: "2026-06-02T10:00:00+0000",
  },
  {
    id: "23850000000000002",
    name: "Retargeting — 30d viewers",
    objective: "OUTCOME_SALES",
    status: "ACTIVE",
    dailyBudget: 35,
    buyingType: "AUCTION",
    createdTime: "2026-05-14T10:00:00+0000",
  },
  {
    id: "23850000000000003",
    name: "Lookalike 2% — Broad",
    objective: "OUTCOME_SALES",
    status: "ACTIVE",
    dailyBudget: 60,
    buyingType: "AUCTION",
    createdTime: "2026-06-20T10:00:00+0000",
  },
  {
    id: "23850000000000004",
    name: "Lead Magnet — Ebook",
    objective: "OUTCOME_LEADS",
    status: "PAUSED",
    dailyBudget: 25,
    buyingType: "AUCTION",
    createdTime: "2026-04-08T10:00:00+0000",
  },
  {
    id: "23850000000000005",
    name: "Old Creative Test",
    objective: "OUTCOME_TRAFFIC",
    status: "PAUSED",
    lifetimeBudget: 500,
    buyingType: "AUCTION",
    createdTime: "2026-03-01T10:00:00+0000",
  },
];

const MOCK_INSIGHTS: InsightRow[] = [
  {
    campaign: "Summer Sale — Prospecting",
    spend: 534.2,
    impressions: 148_230,
    clicks: 3_105,
    ctr: 2.09,
    cpc: 0.17,
    cpm: 3.6,
    reach: 96_410,
    frequency: 1.54,
    conversions: { omni_purchase: 47, add_to_cart: 210, link_click: 3_105 },
    roas: 3.42,
  },
  {
    campaign: "Retargeting — 30d viewers",
    spend: 231.9,
    impressions: 41_820,
    clicks: 1_512,
    ctr: 3.62,
    cpc: 0.15,
    cpm: 5.54,
    reach: 18_930,
    frequency: 2.21,
    conversions: { omni_purchase: 34, initiate_checkout: 88 },
    roas: 5.87,
  },
  {
    campaign: "Lookalike 2% — Broad",
    spend: 402.75,
    impressions: 120_540,
    clicks: 1_890,
    ctr: 1.57,
    cpc: 0.21,
    cpm: 3.34,
    reach: 88_720,
    frequency: 1.36,
    conversions: { omni_purchase: 9, add_to_cart: 64 },
    roas: 0.94,
  },
  {
    campaign: "Lead Magnet — Ebook",
    spend: 48.1,
    impressions: 22_400,
    clicks: 610,
    ctr: 2.72,
    cpc: 0.08,
    cpm: 2.15,
    reach: 19_800,
    frequency: 1.13,
    conversions: { lead: 41 },
  },
];

const MOCK_ACCOUNT_ROLLUP: InsightRow[] = [
  {
    spend: 3_642.4,
    impressions: 1_012_300,
    clicks: 21_480,
    ctr: 2.12,
    cpc: 0.17,
    cpm: 3.6,
    reach: 512_000,
    frequency: 1.98,
    conversions: { omni_purchase: 255, add_to_cart: 1_120 },
    roas: 3.38,
  },
];

const MOCK_CUSTOM_AUDIENCES: CustomAudience[] = [
  { id: "ca_1", name: "Past purchasers — 180d", subtype: "CUSTOM", approximateCount: 12_400, deliveryStatus: "ready" },
  { id: "ca_2", name: "Website visitors — 30d", subtype: "WEBSITE", approximateCount: 48_900, deliveryStatus: "ready" },
  { id: "ca_3", name: "Email list — newsletter", subtype: "CUSTOM", approximateCount: 8_150, deliveryStatus: "ready" },
];

const MOCK_PIXELS: Pixel[] = [
  {
    id: "1053872649",
    name: "Main Store Pixel",
    lastFiredTime: new Date(Date.now() - 2 * 60_000).toISOString(),
  },
  {
    id: "2098446110",
    name: "Landing Page Pixel",
    lastFiredTime: new Date(Date.now() - 9 * 86_400_000).toISOString(),
  },
];

const MOCK_PAGES = [
  { id: "page_1", name: "Acme Store" },
  { id: "page_2", name: "Acme Outlet" },
];

const MOCK_INTERESTS: InterestResult[] = [
  { id: "i1", name: "Yoga", audienceSizeLower: 28_000_000, audienceSizeUpper: 33_000_000 },
  { id: "i2", name: "Running", audienceSizeLower: 94_000_000, audienceSizeUpper: 110_000_000 },
  { id: "i3", name: "Wellness (alternative medicine)", audienceSizeLower: 61_000_000, audienceSizeUpper: 72_000_000 },
  { id: "i4", name: "Pilates", audienceSizeLower: 14_000_000, audienceSizeUpper: 17_000_000 },
  { id: "i5", name: "Home improvement", audienceSizeLower: 82_000_000, audienceSizeUpper: 95_000_000 },
  { id: "i6", name: "Small business owners", audienceSizeLower: 22_000_000, audienceSizeUpper: 26_000_000 },
  { id: "i7", name: "Online shopping", audienceSizeLower: 320_000_000, audienceSizeUpper: 380_000_000 },
  { id: "i8", name: "Fitness and wellness", audienceSizeLower: 210_000_000, audienceSizeUpper: 250_000_000 },
];

/** Pending queue items, shaped like the `recommendations` select with the account join. */
export const MOCK_RECOMMENDATIONS = [
  {
    id: "rec-1",
    kind: "pause_object",
    title: "Pause “Lookalike 2% — Broad”",
    rationale:
      "CPA $44.75 vs your account average $14.30 — 3.1x worse, at a 0.94x ROAS across 30 days with no improving trend.",
    estimated_impact: "Saves ~$402/mo",
    action: { kind: "pause_object", objectId: "23850000000000003" },
    created_at: new Date(Date.now() - 6 * 3600_000).toISOString(),
    ad_accounts: { id: "dev-acct-1", name: "Acme Store — Main" },
  },
  {
    id: "rec-2",
    kind: "budget_change",
    title: "Raise Retargeting to $65/day",
    rationale:
      "Best performer at 5.87x ROAS and frequency headroom; currently capped at $35/day while cheaper conversions are available.",
    estimated_impact: "Est. +18 purchases/mo",
    action: {
      kind: "budget_change",
      objectId: "23850000000000002",
      budgetType: "daily",
      amount: 65,
    },
    created_at: new Date(Date.now() - 6 * 3600_000).toISOString(),
    ad_accounts: { id: "dev-acct-1", name: "Acme Store — Main" },
  },
  {
    id: "rec-3",
    kind: "creative_refresh",
    title: "Refresh Retargeting creative",
    rationale:
      "Frequency hit 2.21 and CTR slipped from 4.1% to 3.6% over two weeks — classic fatigue curve.",
    estimated_impact: "Recovers ~$85/mo of efficiency",
    action: null,
    created_at: new Date(Date.now() - 30 * 3600_000).toISOString(),
    ad_accounts: { id: "dev-acct-1", name: "Acme Store — Main" },
  },
  {
    id: "rec-4",
    kind: "creative_refresh",
    title: "Fix the Landing Page Pixel",
    rationale:
      "Silent for 9 days while the site has traffic — conversions on that funnel aren't feeding optimization.",
    estimated_impact: "Restores tracking accuracy",
    action: null,
    created_at: new Date(Date.now() - 30 * 3600_000).toISOString(),
    ad_accounts: { id: "dev-acct-1", name: "Acme Store — Main" },
  },
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let mockIdCounter = 1000;

/**
 * Duck-typed stand-in for MetaAdsClient covering every method the dashboard
 * uses. Small artificial delays keep loading states visible during UI work.
 */
export function createMockMetaClient(): MetaAdsClient {
  const mock = {
    async listCampaigns() {
      await delay(150);
      return MOCK_CAMPAIGNS;
    },
    async getInsights(_id: string, opts?: { level?: string }) {
      await delay(150);
      return opts?.level === "account" ? MOCK_ACCOUNT_ROLLUP : MOCK_INSIGHTS;
    },
    async updateStatus() {
      await delay(100);
    },
    async getBudget() {
      await delay(100);
      return { id: "obj", name: "Mock object", daily: 50 };
    },
    async updateBudget() {
      await delay(100);
    },
    launch: {
      async searchInterests(q: string) {
        await delay(200);
        const needle = q.toLowerCase();
        return MOCK_INTERESTS.filter((i) => i.name.toLowerCase().includes(needle));
      },
      async listCustomAudiences() {
        await delay(120);
        return MOCK_CUSTOM_AUDIENCES;
      },
      async estimateAudience() {
        await delay(350);
        return {
          monthlyActiveUsersLower: 2_100_000,
          monthlyActiveUsersUpper: 2_500_000,
          estimateReady: true,
        };
      },
      async listPixels() {
        await delay(120);
        return MOCK_PIXELS;
      },
      async uploadImage() {
        await delay(150);
        return "mock_image_hash_abc123";
      },
      async listPages() {
        await delay(120);
        return MOCK_PAGES;
      },
      async sendCapiEvent() {
        await delay(400);
        return { eventsReceived: 1, fbtraceId: "DEVTRACE123" };
      },
      async createCampaign() {
        await delay(250);
        return `dev-campaign-${mockIdCounter++}`;
      },
      async createAdSet() {
        await delay(250);
        return `dev-adset-${mockIdCounter++}`;
      },
      async createAd() {
        await delay(250);
        return `dev-ad-${mockIdCounter++}`;
      },
    },
  };
  return mock as unknown as MetaAdsClient;
}
