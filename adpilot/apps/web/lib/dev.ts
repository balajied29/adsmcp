/**
 * Dev login mode — set NEXT_PUBLIC_DEV_LOGIN=1 to browse the dashboard with a
 * fake user and seeded dummy data (no Supabase, no Meta app required).
 * NEVER set this in production.
 */
export function devMode(): boolean {
  return process.env.NEXT_PUBLIC_DEV_LOGIN === "1";
}

export const DEV_USER = {
  id: "00000000-0000-0000-0000-00000000dev1",
  email: "dev@adpilot.local",
};

export const DEV_RELAY_TOKEN = "dev-relay-token";
