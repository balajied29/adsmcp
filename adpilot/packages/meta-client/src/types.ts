export interface AdAccount {
  id: string;
  name: string;
  status: string;
  currency: string;
  timezone?: string;
}

export interface Campaign {
  id: string;
  name: string;
  objective?: string;
  status: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  buyingType?: string;
  createdTime?: string;
}

export interface AdSet {
  id: string;
  name: string;
  status: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  billingEvent?: string;
  optimizationGoal?: string;
  targetingSummary?: Record<string, unknown>;
  startTime?: string;
  endTime?: string;
}

export interface Ad {
  id: string;
  name: string;
  status: string;
  creativeId?: string;
  creativeName?: string;
}

export interface InsightRow {
  campaign?: string;
  adset?: string;
  ad?: string;
  dateStart?: string;
  dateStop?: string;
  age?: string;
  gender?: string;
  placement?: string;
  country?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  reach?: number;
  frequency?: number;
  conversions?: Record<string, number>;
  roas?: number;
}

export type InsightsLevel = "account" | "campaign" | "adset" | "ad";

export type DatePreset =
  | "today"
  | "yesterday"
  | "last_3d"
  | "last_7d"
  | "last_14d"
  | "last_28d"
  | "last_30d"
  | "last_90d"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "maximum";

export type Breakdown =
  | "age"
  | "gender"
  | "publisher_platform"
  | "platform_position"
  | "country";

export interface InsightsOptions {
  level?: InsightsLevel;
  datePreset?: DatePreset;
  since?: string;
  until?: string;
  breakdowns?: Breakdown[];
}
