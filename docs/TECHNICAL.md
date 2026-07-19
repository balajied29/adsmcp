# AdPilot — Technical Reference

*Architecture, security model, deployment runbook, and open research items.*
*Repo: `github.com/balajied29/adsmcp` · Status: private beta · Last updated: July 2026*

---

## 1. System overview

```
                                ┌────────────────────────────────────────────┐
Customer browser ──────────────►│ apps/web — Next.js 16 (Vercel)             │
                                │  landing · auth · chat UI · launcher ·     │
                                │  approvals · pixels · integrations         │
                                │                                            │
MCP clients (Claude/Cursor) ───►│  /api/mcp (hosted connector, bearer keys)  │
Shopify webhooks ──────────────►│  /api/capi/shopify/[token] (CAPI relay)    │
Stripe webhooks ───────────────►│  /api/stripe/webhook                       │
                                └───────┬───────────────┬────────────────────┘
                                        │               │
                        Claude API      │               │  Supabase (Postgres + Auth)
                 (claude-opus-4-8) ◄────┤               │  RLS on every table
                                        │               │
                                ┌───────┴───────────────┴───────┐
Daily cron (GitHub Actions) ───►│ apps/worker — audit agent      │
                                └───────┬───────────────────────┘
                                        │
                                Meta Graph API v25.0
                          (packages/meta-client, per-tenant tokens)
```

**Monorepo:** npm workspaces — `packages/meta-client` (shared Meta client), `apps/web`, `apps/worker`. A standalone stdio MCP server lives in `meta-ads-mcp/` (predates the SaaS; same tool surface; useful for local/BYO-token use).

## 2. Components

| Component | Stack | Responsibility |
|---|---|---|
| `packages/meta-client` | TS, zero deps | Typed Graph API v25.0 client: reads, writes, OAuth exchanges, interest search, delivery estimates, image upload, CAPI events. Cursor pagination (5-page cap), token in `Authorization` header only, error mapping (190→refresh hint, 10/200s→scopes, 4/17/32/613/80000+→rate limit + `x-business-use-case-usage`). Ships a mock twin (`/mock`) used by dev mode and dry runs. |
| `apps/web` | Next.js 16, Tailwind 4, Supabase SSR | Everything user-facing + all API routes. Chat agent, launcher, approval queue, hosted MCP, relays. |
| `apps/worker` | Node 22, tsx/tsc | Nightly audit per managed account → `recommendations` rows + Resend digest. `--dry-run` audits mock data. |
| Agents | `@anthropic-ai/sdk` tool runner, model `claude-opus-4-8` | **Chat agent** (`lib/agent.ts`): data tools + *render tools* that emit typed UI blocks. **Audit agent** (worker): data tools + `submit_audit` tool whose schema mirrors the `recommendations` table. |

### The block contract (key design decision)

`/api/chat` returns typed blocks (`text` | `audit` | `campaign`). The UI renders blocks; it doesn't know or care whether they came from the live Claude agent or the scripted dev-mode brain. The agent produces structured cards by *calling render tools* (schema = the card's shape) rather than emitting prose — this is what keeps model output renderable and safe.

### Execution path (single choke point)

All approved actions — chat-card Approves, queue Approves, MCP `update_*` calls — flow through one guarded module (`lib/execute.ts`): re-fetch current state from Meta at execution time → enforce the 5x budget rule → execute → append to `action_log`. Guardrails are deterministic code; no prompt can bypass them.

## 3. Data model (Supabase, RLS on everything)

| Table | Purpose | Notes |
|---|---|---|
| `meta_connections` | OAuth grants | Token AES-256-GCM encrypted; service-role-only writes |
| `ad_accounts` | Discovered accounts | `managed` flag gates the audit worker; `act_\d+` check constraint |
| `recommendations` | Audit output | `proposed → approved/dismissed/executed/failed`, `action` jsonb payload |
| `action_log` | Audit trail | **Append-only** (no update/delete policies); links `recommendation_id` |
| `subscriptions` | Stripe state | Webhook-only writes |
| `mcp_keys` | Hosted MCP auth | SHA-256 hash only; plaintext shown once |
| `capi_relays` | Shopify relays | Random URL token; optional Shopify HMAC secret |

`supabase/schema.sql` is idempotent — re-run after every schema change.

## 4. Security model

1. **Tokens:** long-lived Meta user tokens (~60d) AES-256-GCM encrypted (`TOKEN_ENCRYPTION_KEY`, 32 bytes, shared web+worker). Decryption only in `lib/meta.ts` (web) and worker `crypto.ts`. Tokens never appear in URLs; redacted from all error strings.
2. **Tenancy:** RLS scopes every table to `workspace_id = auth.uid()`. Admin (service-role) paths re-check ownership explicitly where used.
3. **Guardrails (deterministic):** create-paused defaults; 5x budget rule at execution time; explicit `activate`/`confirm_large_change` opt-ins; append-only audit log.
4. **Hosted MCP:** bearer keys stored as SHA-256 hashes; invalid keys → 401 (never 500); tool errors are redacted before returning.
5. **Webhooks:** Stripe — manual HMAC-SHA256 with timestamp tolerance (5 min) and `timingSafeEqual`. Shopify — optional HMAC (base64) verified the same way.
6. **Dev mode:** `NEXT_PUBLIC_DEV_LOGIN=1` swaps auth + Meta + DB for mocks. **Must never be set in production** — it bypasses auth by design. (Hardening idea below.)

## 5. Deployment runbook (condensed; full steps in `adpilot/DEPLOY.md`)

**Order matters:**

1. **Supabase**: create project → run `schema.sql` → note URL + anon + service keys.
2. **Meta app**: Business-type app, Facebook Login for Business + Marketing API; redirect URI `{APP_URL}/api/meta/oauth/callback`. Dev Mode = only app-role holders can connect (the beta program). Advanced Access needs Business Verification + App Review (`adpilot/APP_REVIEW.md`).
3. **Vercel**: import repo, Root Directory `adpilot/apps/web` (the `vercel-build` script builds the shared package first — no custom config). Env matrix:

   | Var | web | worker (GH Actions) |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | ✅ | URL as `SUPABASE_URL` |
   | `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ |
   | `META_APP_ID` / `META_APP_SECRET` | ✅ | — |
   | `TOKEN_ENCRYPTION_KEY` | ✅ | ✅ **same value** |
   | `ANTHROPIC_API_KEY` | ✅ | ✅ |
   | `NEXT_PUBLIC_APP_URL` | ✅ | `APP_URL` var |
   | `RESEND_API_KEY` / `DIGEST_FROM_EMAIL` | — | optional |
   | `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | when billing | — |
   | `NEXT_PUBLIC_DEV_LOGIN` | **never** | **never** |

4. **Callbacks:** Supabase Site URL + `/auth/confirm` redirect; Meta OAuth URI; Stripe webhook (3 events).
5. **Worker:** GH Actions `audit-worker.yml` — set secrets + `AUDIT_WORKER_ENABLED=true`; test via manual dispatch.
6. **Smoke:** signup → Connect Meta → dashboard data → chat audit → approve a pause.

**Runtime notes:** chat route sets `maxDuration = 300` — Vercel Hobby caps lower; use Pro/Fluid for long agent turns. Worker exits non-zero if any account fails (cron alerting hooks onto this).

## 6. Cost model

| Item | Estimate |
|---|---|
| Chat agent turn (Opus, ~3–6 tool calls) | ~$0.05–0.30 |
| Nightly audit per account | ~$0.10–0.40 |
| Infra (Vercel Pro + Supabase free tier + Actions) | ~$20–45/mo flat |
| → Per-account COGS at daily audits | **~$3–12/mo** vs $99 price point |

## 7. Known limitations & research items

**Correctness / product research**
- **Projections model** is a v1 power-law heuristic (exponent −0.15, ±20% band). Research: backtest against real account histories; consider per-vertical curves.
- **Budget minor-units** assume 100-subunit currencies; JPY/KRW etc. need a currency-exponent map in `format`/`meta-client`.
- **Audit agent quality** is unvalidated at scale — needs an eval set of real account snapshots with known-good recommendations before public launch.
- **Multi-connection workspaces**: MCP context and chat use the *first* connection/account; needs explicit account scoping UX.

**Platform / integration research**
- **Meta App Review** is the launch gate (external, weeks). Token strategy after launch: refresh nudges (email at ~50 days via `token_expires_at`) or System User tokens for business-owned accounts.
- **Rate limits**: Meta BUC limits per ad account; worker currently audits serially (fine to ~100s of accounts). Research: header-driven backoff using the surfaced `x-business-use-case-usage`.
- **Hosted MCP**: stateless JSON-only (no SSE stream, no sessions). Claude Code/Cursor work with bearer headers today; claude.ai custom connectors prefer OAuth — an OAuth-wrapped MCP endpoint is the research item.
- **CAPI relay**: Shopify-only; event mapping covers `orders/create`. Research: refunds (`orders/refunded` → negative events?), WooCommerce, checkout events.

**Hardening backlog (pre-GA)**
- Fail the production build if `NEXT_PUBLIC_DEV_LOGIN` is set (belt-and-braces).
- Rate-limit `/api/mcp` and the relay endpoint per key/token.
- Rotate/expire MCP keys (age-based) + scope keys read-only vs read-write.
- Encrypt `shopify_webhook_secret` at rest (currently plaintext column, RLS-protected).
- Structured logging + error tracking (Sentry) on web and worker; alert on worker non-zero exits.
- E2E test suite against dev mode (Playwright) — the mock layer makes this cheap.

## 8. Verification status (what's proven vs. pending)

| Area | Status |
|---|---|
| Builds (strict TS, all workspaces) | ✅ clean |
| OAuth flow, dashboards, launcher, approvals, MCP, relay | ✅ exercised end-to-end in dev mode (mock Meta) |
| Guardrails (5x rule via chat, queue, MCP) | ✅ verified rejecting + allowing correctly |
| Live Meta Graph calls | ✅ error path verified against real API; happy path pending a real token |
| Live Claude agent turns | ⚠ pending `ANTHROPIC_API_KEY` (fallback verified) |
| Resend / Stripe live flows | ⚠ pending keys (env-gated, clean errors verified) |
