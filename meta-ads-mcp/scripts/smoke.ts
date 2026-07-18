/**
 * Smoke test: verifies the token works before wiring the server into Claude.
 * Run with: npm run smoke
 */
import { loadConfig } from "../src/config.js";
import { GraphClient } from "../src/graph.js";

async function main() {
  const config = loadConfig();
  const graph = new GraphClient(config.accessToken, config.apiVersion);

  console.log(`Graph API version: ${config.apiVersion}`);

  const me = await graph.get<{ id: string; name?: string }>("me", {
    fields: "id,name",
  });
  console.log(`Token OK — authenticated as ${me.name ?? me.id}`);

  const accounts = await graph.getAll<{
    id: string;
    name: string;
    account_status: number;
    currency: string;
  }>("me/adaccounts", { fields: "id,name,account_status,currency" });

  if (!accounts.length) {
    console.log(
      "No ad accounts visible to this token. Check that your user has a role on the ad account and the token has ads_read.",
    );
    return;
  }

  console.log(`Ad accounts (${accounts.length}):`);
  for (const a of accounts) {
    console.log(
      `  ${a.id}  ${a.name}  [${a.account_status === 1 ? "ACTIVE" : `status ${a.account_status}`}]  ${a.currency}`,
    );
  }

  if (config.defaultAdAccountId) {
    const found = accounts.some((a) => a.id === config.defaultAdAccountId);
    console.log(
      found
        ? `Default account ${config.defaultAdAccountId} is accessible. ✅`
        : `⚠️  Default account ${config.defaultAdAccountId} was NOT in the first pages of results — double-check META_AD_ACCOUNT_ID.`,
    );
  }
}

main().catch((err) => {
  console.error("Smoke test failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
