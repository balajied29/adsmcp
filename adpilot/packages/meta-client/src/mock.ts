/**
 * Shared mock Meta client + seeded data — used by the web app's dev-login mode
 * and the worker's --dry-run. Import via "@adpilot/meta-client/mock".
 */
import type { MetaAdsClient } from "./index.js";
import type { Campaign, InsightRow } from "./types.js";
import type { CustomAudience, InterestResult, Pixel } from "./launch.js";

export const MOCK_ACCOUNT = {
  id: "dev-acct-1",
  account_id: "act_1234567890",
  name: "Acme Store — Main",
  currency: "USD",
  status: "ACTIVE",
  connection_id: "dev-conn-1",
};

export const MOCK_CAMPAIGNS: Campaign[] = [
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
];

export const MOCK_CAMPAIGN_INSIGHTS: InsightRow[] = [
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
    conversions: { omni_purchase: 47, add_to_cart: 210 },
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
];

export const MOCK_ACCOUNT_ROLLUP: InsightRow[] = [
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

export const MOCK_PIXELS: Pixel[] = [
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

export const MOCK_CUSTOM_AUDIENCES: CustomAudience[] = [
  { id: "ca_1", name: "Past purchasers — 180d", subtype: "CUSTOM", approximateCount: 12_400, deliveryStatus: "ready" },
  { id: "ca_2", name: "Website visitors — 30d", subtype: "WEBSITE", approximateCount: 48_900, deliveryStatus: "ready" },
];

export const MOCK_INTERESTS: InterestResult[] = [
  { id: "i1", name: "Yoga", audienceSizeLower: 28_000_000 },
  { id: "i2", name: "Running", audienceSizeLower: 94_000_000 },
  { id: "i4", name: "Pilates", audienceSizeLower: 14_000_000 },
  { id: "i7", name: "Online shopping", audienceSizeLower: 320_000_000 },
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let mockIdCounter = 1000;

export function createMockMetaClient(): MetaAdsClient {
  const mock = {
    async listCampaigns() {
      await delay(50);
      return MOCK_CAMPAIGNS;
    },
    async getInsights(_id: string, opts?: { level?: string }) {
      await delay(50);
      return opts?.level === "account" ? MOCK_ACCOUNT_ROLLUP : MOCK_CAMPAIGN_INSIGHTS;
    },
    async listAdSets() {
      await delay(50);
      return [];
    },
    async updateStatus() {
      await delay(50);
    },
    async getBudget() {
      await delay(50);
      return { id: "obj", name: "Mock object", daily: 50 };
    },
    async updateBudget() {
      await delay(50);
    },
    launch: {
      async searchInterests(q: string) {
        const needle = q.toLowerCase();
        return MOCK_INTERESTS.filter((i) => i.name.toLowerCase().includes(needle));
      },
      async listCustomAudiences() {
        return MOCK_CUSTOM_AUDIENCES;
      },
      async estimateAudience() {
        return {
          monthlyActiveUsersLower: 2_100_000,
          monthlyActiveUsersUpper: 2_500_000,
          estimateReady: true,
        };
      },
      async listPixels() {
        return MOCK_PIXELS;
      },
      async uploadImage() {
        await delay(150);
        return "mock_image_hash_abc123";
      },
      async listPages() {
        return [{ id: "page_1", name: "Acme Store" }];
      },
      async sendCapiEvent() {
        return { eventsReceived: 1, fbtraceId: "DEVTRACE123" };
      },
      async createCampaign() {
        return `dev-campaign-${mockIdCounter++}`;
      },
      async createAdSet() {
        return `dev-adset-${mockIdCounter++}`;
      },
      async createAd() {
        return `dev-ad-${mockIdCounter++}`;
      },
    },
  };
  return mock as unknown as MetaAdsClient;
}
