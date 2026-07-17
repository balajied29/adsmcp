import "dotenv/config";

const DEFAULT_API_VERSION = "v25.0";
const ACCOUNT_ID_PATTERN = /^act_\d+$/;

export interface Config {
  accessToken: string;
  defaultAdAccountId: string | undefined;
  apiVersion: string;
}

export function loadConfig(): Config {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      "META_ACCESS_TOKEN is not set. Create a long-lived token with ads_read + ads_management scopes (see README) and export it or add it to .env.",
    );
  }

  const defaultAdAccountId = process.env.META_AD_ACCOUNT_ID || undefined;
  if (defaultAdAccountId && !ACCOUNT_ID_PATTERN.test(defaultAdAccountId)) {
    throw new Error(
      `META_AD_ACCOUNT_ID must match act_<digits> (got "${defaultAdAccountId}").`,
    );
  }

  return {
    accessToken,
    defaultAdAccountId,
    apiVersion: process.env.META_API_VERSION || DEFAULT_API_VERSION,
  };
}

export function isValidAccountId(id: string): boolean {
  return ACCOUNT_ID_PATTERN.test(id);
}
