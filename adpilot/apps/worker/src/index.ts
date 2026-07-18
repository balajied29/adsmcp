/**
 * AdPilot audit worker — run daily on a cron (Railway/Fly scheduled job).
 *
 *   npm run audit             real mode: every managed account in the DB
 *   npm run audit -- --dry-run  mock account, no DB writes — prints the digest
 *
 * Flow per account: decrypt token → audit agent → insert `recommendations`
 * rows (status: proposed) → digest. Email delivery is a TODO (Resend);
 * the digest currently prints to stdout for cron log capture.
 */
import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MetaAdsClient } from "@adpilot/meta-client";
import { createMockMetaClient, MOCK_ACCOUNT } from "@adpilot/meta-client/mock";
import { runAuditAgent, type AuditResult } from "./audit-agent.js";
import { decryptToken } from "./crypto.js";
import { emailEnabled, sendDigestEmail } from "./email.js";

const DRY_RUN = process.argv.includes("--dry-run");

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function printDigest(accountName: string, audit: AuditResult): void {
  const line = "─".repeat(60);
  console.log(`\n${line}`);
  console.log(`AUDIT DIGEST — ${accountName}   score: ${audit.score}/100`);
  console.log(line);
  console.log(audit.summary);
  console.log("");
  for (const [i, r] of audit.recommendations.entries()) {
    const tag = r.action ? "[approve in dashboard]" : r.kind === "observation" ? "[fyi]" : "[manual]";
    console.log(`${i + 1}. ${r.title}  ${tag}`);
    console.log(`   ${r.rationale}`);
    console.log(`   Impact: ${r.estimatedImpact}`);
  }
  console.log(line);
}

async function persistRecommendations(
  supabase: SupabaseClient,
  workspaceId: string,
  adAccountRowId: string,
  audit: AuditResult,
): Promise<void> {
  const rows = audit.recommendations
    .filter((r) => r.kind !== "observation")
    .map((r) => ({
      workspace_id: workspaceId,
      ad_account_id: adAccountRowId,
      kind: r.kind,
      title: r.title,
      rationale: r.rationale,
      estimated_impact: r.estimatedImpact,
      action: r.action,
      status: "proposed",
    }));
  if (!rows.length) return;
  const { error } = await supabase.from("recommendations").insert(rows);
  if (error) throw new Error(`Failed to store recommendations: ${error.message}`);
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — the audit agent needs Claude API access.",
    );
  }

  if (DRY_RUN) {
    console.log("Dry run: auditing the mock account (no DB writes).");
    const audit = await runAuditAgent(createMockMetaClient(), {
      accountId: MOCK_ACCOUNT.account_id,
      name: MOCK_ACCOUNT.name,
      currency: MOCK_ACCOUNT.currency,
    });
    printDigest(MOCK_ACCOUNT.name, audit);
    return;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL ?? requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data: accounts, error } = await supabase
    .from("ad_accounts")
    .select(
      "id, workspace_id, account_id, name, currency, meta_connections ( encrypted_token )",
    )
    .eq("managed", true);
  if (error) throw new Error(`Failed to list managed accounts: ${error.message}`);

  console.log(`Audit run: ${accounts?.length ?? 0} managed account(s).`);
  let failures = 0;

  for (const account of accounts ?? []) {
    const label = `${account.name} (${account.account_id})`;
    try {
      const connection = account.meta_connections as unknown as {
        encrypted_token: string;
      } | null;
      if (!connection) throw new Error("No connection row for account");

      const meta = new MetaAdsClient(decryptToken(connection.encrypted_token));
      const audit = await runAuditAgent(meta, {
        accountId: account.account_id,
        name: account.name,
        currency: account.currency,
      });
      await persistRecommendations(supabase, account.workspace_id, account.id, audit);
      printDigest(label, audit);

      if (emailEnabled()) {
        const { data: owner } = await supabase.auth.admin.getUserById(account.workspace_id);
        if (owner?.user?.email) {
          await sendDigestEmail(owner.user.email, account.name, audit);
          console.log(`  digest emailed to ${owner.user.email}`);
        }
      }
    } catch (err) {
      failures++;
      console.error(`✗ ${label}: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (failures) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
