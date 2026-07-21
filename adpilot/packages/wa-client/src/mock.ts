/**
 * Shared mock WhatsApp client + seeded data — used by the web app's dev-login
 * mode and the worker's --dry-run. Import via "@adpilot/wa-client/mock".
 */
import type { WaAdsClient } from "./index.js";
import type { SendResult, WaPhoneNumber, WaTemplate } from "./types.js";

export const MOCK_WA_CONNECTION = {
  id: "dev-wa-conn-1",
  waba_id: "1234567890",
  phone_number_id: "9876543210",
  display_phone_number: "+1 555-0100",
  verified_name: "Acme Store",
  quality_rating: "GREEN",
  messaging_tier: "TIER_1K",
};

export const MOCK_WA_TEMPLATES: WaTemplate[] = [
  {
    id: "tpl_1",
    name: "order_shipped",
    language: "en_US",
    category: "UTILITY",
    status: "APPROVED",
    components: [{ type: "BODY", text: "Hi {{1}}, your order has shipped! Track it here: {{2}}" }],
  },
  {
    id: "tpl_2",
    name: "weekend_sale",
    language: "en_US",
    category: "MARKETING",
    status: "APPROVED",
    components: [{ type: "BODY", text: "Hey {{1}}! This weekend only — 20% off everything. Shop now: {{2}}" }],
  },
  {
    id: "tpl_3",
    name: "new_arrivals",
    language: "en_US",
    category: "MARKETING",
    status: "PENDING",
    components: [{ type: "BODY", text: "{{1}}, check out what just landed in the store." }],
  },
];

export const MOCK_WA_CONTACTS = [
  { id: "wac_1", phone_e164: "15550101001", display_name: "Jordan Lee", tags: ["vip"], opt_in_source: "manual", opted_out: false },
  { id: "wac_2", phone_e164: "15550101002", display_name: "Priya Nair", tags: ["newsletter"], opt_in_source: "csv_import", opted_out: false },
  { id: "wac_3", phone_e164: "15550101003", display_name: "Sam Torres", tags: [], opt_in_source: "inbound_message", opted_out: false },
  { id: "wac_4", phone_e164: "15550101004", display_name: "Ana Costa", tags: ["newsletter"], opt_in_source: "csv_import", opted_out: true },
];

export const MOCK_WA_AUDIENCES = [
  { id: "waa_1", name: "Newsletter subscribers", member_count: 2 },
  { id: "waa_2", name: "VIP customers", member_count: 1 },
];

export const MOCK_WA_BROADCASTS = [
  {
    id: "wab_1",
    name: "Weekend Sale Blast",
    status: "sent",
    template_name: "weekend_sale",
    recipient_count: 2,
    sent_count: 2,
    delivered_count: 2,
    failed_count: 0,
    created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let wamidCounter = 1000;

export function createMockWaClient(): WaAdsClient {
  const mock = {
    async sendTemplateMessage(): Promise<SendResult> {
      await delay(80);
      return { wamid: `wamid.mock.${wamidCounter++}` };
    },
    async sendTextMessage(): Promise<SendResult> {
      await delay(80);
      return { wamid: `wamid.mock.${wamidCounter++}` };
    },
    async listTemplates(): Promise<WaTemplate[]> {
      await delay(80);
      return MOCK_WA_TEMPLATES;
    },
    async createTemplate() {
      await delay(150);
      return { id: `tpl_${wamidCounter++}`, status: "PENDING" };
    },
    async getPhoneNumber(): Promise<WaPhoneNumber> {
      await delay(50);
      return {
        id: MOCK_WA_CONNECTION.phone_number_id,
        displayPhoneNumber: MOCK_WA_CONNECTION.display_phone_number,
        verifiedName: MOCK_WA_CONNECTION.verified_name,
        qualityRating: MOCK_WA_CONNECTION.quality_rating,
      };
    },
    graph: {
      redact: (s: string) => s,
    },
  };
  return mock as unknown as WaAdsClient;
}
