/**
 * Dev-login mock data for the WhatsApp module. Row shapes mirror what
 * Supabase returns, built on top of @adpilot/wa-client/mock's seed data so
 * the client-level mock and the "DB rows" the UI reads stay consistent.
 */
import {
  MOCK_WA_AUDIENCES,
  MOCK_WA_BROADCASTS,
  MOCK_WA_CONNECTION,
  MOCK_WA_CONTACTS,
  MOCK_WA_TEMPLATES,
} from "@adpilot/wa-client/mock";

export { MOCK_WA_TEMPLATES };

export const MOCK_WA_CONNECTIONS = [
  {
    id: "dev-wa-conn-1",
    waba_id: MOCK_WA_CONNECTION.waba_id,
    phone_number_id: MOCK_WA_CONNECTION.phone_number_id,
    display_phone_number: MOCK_WA_CONNECTION.display_phone_number,
    verified_name: MOCK_WA_CONNECTION.verified_name,
    quality_rating: MOCK_WA_CONNECTION.quality_rating,
    messaging_tier: MOCK_WA_CONNECTION.messaging_tier,
    created_at: new Date(Date.now() - 10 * 86_400_000).toISOString(),
  },
];

export const MOCK_WA_CONTACT_ROWS = MOCK_WA_CONTACTS.map((c) => ({
  ...c,
  created_at: new Date(Date.now() - 20 * 86_400_000).toISOString(),
}));

export const MOCK_WA_AUDIENCE_ROWS = MOCK_WA_AUDIENCES;

export const MOCK_WA_BROADCAST_ROWS = MOCK_WA_BROADCASTS;

export const MOCK_WA_INBOUND = [
  {
    id: "wain_1",
    contact_phone_e164: "15550101003",
    contact_name: "Sam Torres",
    body: "Hi! Do you have this in size M?",
    referral: null,
    received_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
  },
  {
    id: "wain_2",
    contact_phone_e164: "15550109988",
    contact_name: null,
    body: "Interested — is this still available?",
    referral: { source_id: "23850000000000001", headline: "Summer Sale — Prospecting" },
    received_at: new Date(Date.now() - 26 * 3600_000).toISOString(),
  },
];
