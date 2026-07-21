# AdPilot — Technical Reference v2

*Architecture, security model, deployment runbook, and open research items.*
*Repo: `github.com/balajied29/adsmcp` · Status: private beta · Last updated: July 2026*
*v2 adds the **WhatsApp Cloud module**: multi-tenant WABA connections, template management, bulk broadcasts, inbox webhooks, and WhatsApp-delivered audit digests/approvals.*

---

## 1. System overview

```
                                ┌──────────────────────────────────────────────────┐
Customer browser ──────────────►│ apps/web — Next.js 16 (Vercel)                   │
                                │  landing · auth · chat UI · launcher ·           │
                                │  approvals · pixels · integrations ·             │
                                │  WA: connect · templates · audiences · broadcasts│
                                │                                                  │
MCP clients (Claude/Cursor) ───►│  /api/mcp (hosted connector, bearer keys)        │
Shopify webhooks ──────────────►│  /api/capi/shopify/[token] (CAPI relay)          │
Stripe webhooks ───────────────►│  /api/stripe/webhook                             │
WhatsApp Cloud webhooks ───────►│  /api/whatsapp/webhook (single endpoint,         │
                                │   routed by phone_number_id → workspace)         │
                                └───────┬───────────────┬──────────────────────────┘
                                        │               │
                        Claude API      │               │  Supabase (Postgres + Auth)
                 (claude-opus-4-8) ◄────┤               │  RLS on every table
                                        │               │
                                ┌───────┴───────────────┴───────┐
Daily cron (GitHub Actions) ───►│ apps/worker                    │
                                │  · audit agent (nightly)       │
                                │  · WA broadcast dispatcher     │
                                │    (queue drain, every 1 min)  │
                                └───────┬────────────┬───────────┘
                                        │            │
                          Meta Graph API v25.0       │
                    (packages/meta-client,           │
                     per-tenant ad tokens)   WhatsApp Cloud API (Graph v25.0)
                                             (packages/wa-client, per-tenant
                                              WABA tokens, embedded signup)
```

**Monorepo:** npm workspaces — `packages/meta-client` (shared Meta ads client), `packages/wa-client` (WhatsApp Cloud client, shares the HTTP/error core pattern with meta-client), `apps/web`, `apps/worker`. A standalone stdio MCP server lives in `meta-ads-mcp/` (predates the SaaS; same tool surface; useful for local/BYO-token use).

## 2. Components

| Component | Stack | Responsibility |
|---|---|---|
| `packages/meta-client` | TS, zero deps | Typed Graph API v25.0 client: reads, writes, OAuth exchanges, interest search, delivery estimates, image upload, CAPI events. Cursor pagination (5-page cap), token in `Authorization` header only, error mapping (190→refresh hint, 10/200s→scopes, 4/17/32/613/80000+→rate limit + `x-business-use-case-usage`). Ships a mock twin (`/mock`) used by dev mode and dry runs. |
| `packages/wa-client` | TS, zero deps | Typed WhatsApp Cloud API client: send template/text/media messages, template CRUD + sync, media upload, phone-number and WABA reads, embedded-signup code exchange. Error mapping for WA-specific codes (131047→re-engagement/24h window, 131026→undeliverable, 131048/131056→spam-rate/pair-rate limit, 130429→throughput, 133010→number not registered). Ships a mock twin for dev mode and broadcast dry runs. |
| `apps/web` | Next.js 16, Tailwind 4, Supabase SSR | Everything user-facing + all API routes. Chat agent, launcher, approval queue, hosted MCP, relays, and the WA surfaces: connect, template studio, contacts/audiences, broadcast composer, delivery reports, inbox. |
| `apps/worker` | Node 22, tsx/tsc | (a) Nightly audit per managed account → `recommendations` rows + digest (email). (b) **Broadcast dispatcher**: drains `wa_outbound_queue` on a cron, paced per phone number. `--dry-run` runs both against mock data. |
| Agents | `@anthropic-ai/sdk` tool runner, model `claude-opus-4-8` | **Chat agent** (`lib/agent.ts`): data tools + *render tools* emitting typed UI blocks. **Audit agent** (worker): data tools + `submit_audit` tool mirroring `recommendations`. |

### The block contract (unchanged)

`/api/chat` returns typed blocks (`text` | `audit` | `campaign`). The UI renders blocks; it doesn't know or care whether they came from the live Claude agent or the scripted dev-mode brain. The agent produces structured cards by *calling render tools* (schema = the card's shape) rather than emitting prose. A `broadcast_draft` render tool is scoped as a near-term extension (§8) — not yet wired into the live agent's tool list.

### Execution path (single choke point, now two lanes)

All approved actions flow through guarded modules; guardrails are deterministic code — no prompt can bypass them.

- **Ads lane** (`lib/execute.ts`): re-fetch current state from Meta at execution time → enforce 5x budget rule → execute → append to `action_log`.
- **Messaging lane** (`lib/wa-execute.ts`): approving a broadcast never sends directly — it *enqueues*. Deterministic checks at enqueue time: template is `APPROVED`, opt-outs excluded, per-recipient dedupe (no duplicate template+recipient within 24h), audience snapshot materialized at enqueue (not send) time. The dispatcher paces sends and appends every attempt to `wa_send_log`.

## 3. WhatsApp Cloud module

### 3.1 Multi-tenant connection

Each workspace connects **its own** WhatsApp Business Account — AdPilot acts as a Meta **Tech Provider**, not the message sender of record.

1. User clicks *Connect WhatsApp* → Meta Embedded Signup flow (Facebook Login for Business config with `whatsapp_business_management` + `whatsapp_business_messaging`).
2. Callback returns a code → `wa-client` exchanges it for a **business integration system-user token** scoped to that customer's WABA (long-lived — no 60-day refresh cycle like ads tokens).
3. We store: `waba_id`, `phone_number_id`, display number, token (AES-256-GCM, same envelope as ads tokens).
4. We subscribe our app to the WABA (`/{waba_id}/subscribed_apps`) so **one** webhook endpoint receives events for every tenant; routing key is `phone_number_id` (delivery/inbound) or `waba_id` (template/quality events).

A workspace can connect multiple WABAs/numbers; every WA table is keyed by `wa_connection_id` and RLS-scoped to the workspace, same as the ads tables.

### 3.2 Templates

- Template studio: create/edit → submit via Graph API (`/{waba_id}/message_templates`), category `MARKETING` / `UTILITY` / `AUTHENTICATION`, with variable placeholders and header media.
- Status is webhook-driven (`message_template_status_update`: approved/rejected/paused/disabled) — we never poll.
- A sync action reconciles drift (templates edited directly in WhatsApp Manager).
- The broadcast composer only offers `APPROVED` templates; anything else is visibly gated.

### 3.3 Contacts, audiences, consent

| Concept | Behavior |
|---|---|
| Contacts | Manual add or CSV import (E.164 normalization + validation). |
| Audiences | Saved segments (tags, source). Snapshot is materialized at enqueue time, not send time — what you approved is what sends. |
| Consent | `opt_in_source` + timestamp required on every contact used in a marketing broadcast. Inbound `STOP`/`UNSUBSCRIBE` auto-sets `opted_out`; opted-out contacts are excluded deterministically at enqueue *and* skipped defensively at send. |

### 3.4 Bulk sending pipeline

```
composer draft → approve (wa-execute checks) → wa_broadcasts row
        → fan-out to wa_outbound_queue (one row per recipient, rendered variables)
        → dispatcher (worker cron):
             claim batch (FOR UPDATE SKIP LOCKED, per phone_number_id)
             → send via wa-client → mark sent + wamid
        → webhook updates: sent → delivered → read | failed(code)
        → wa_send_log (append-only) + live delivery report per broadcast
```

Design points:

- **Pacing, not blasting.** Cloud API throughput and messaging-limit tiers are per number and grow with quality; the dispatcher stays under the connection's cached tier and shows the composer an honest "this audience exceeds today's limit — will send over N days" instead of failing mid-send.
- **Retries:** transient errors (throughput, 5xx) → exponential backoff, capped attempts; permanent errors (undeliverable, not-on-WhatsApp) → terminal, surfaced in the report; re-engagement/24h-window errors → terminal (never retry marketing into a closed window).
- **Idempotency:** queue rows carry a deterministic key (`broadcast_id:contact_id`); dispatcher restarts can't double-send.
- **Kill switch:** a broadcast can be paused/cancelled mid-flight; the dispatcher checks broadcast status per claimed batch.
- **Quality protection:** `phone_number_quality_update` webhooks (quality drop, tier downgrade) pause active marketing broadcasts on that number and notify the workspace — protecting the customer's number rating is a product feature, not an afterthought.

### 3.5 Inbox + the 24-hour window

Inbound messages land via the webhook → `wa_inbound`. Within the 24h customer-service window, free-form (non-template) replies are allowed — used for a lightweight inbox UI and CTWA lead capture: inbound messages can carry ad `referral` payloads (ad id, headline), logged against the ad — the missing link between Meta ads and actual WhatsApp leads.

### 3.6 AdPilot's own use of the module (dogfooding, future)

The audit digest and approval flow are designed to eventually ride the same rails — a workspace could opt to receive the nightly audit as a WhatsApp utility template with reply-based Approve/Dismiss routed into `lib/execute.ts`. Not yet wired (§8).

## 4. Data model (Supabase, RLS on everything)

| Table | Purpose | Notes |
|---|---|---|
| `meta_connections` | Ads OAuth grants | Token AES-256-GCM encrypted; service-role-only writes |
| `ad_accounts` | Discovered accounts | `managed` flag gates the audit worker; `act_\d+` check |
| `recommendations` | Audit output | `proposed → approved/dismissed/executed/failed`, `action` jsonb |
| `action_log` | Ads audit trail | **Append-only**; links `recommendation_id` |
| `subscriptions` | Stripe state | Webhook-only writes |
| `mcp_keys` | Hosted MCP auth | SHA-256 hash only; plaintext shown once |
| `capi_relays` | Shopify relays | Random URL token; optional HMAC secret |
| `wa_connections` | WABA grants | `waba_id`, `phone_number_id`, quality + tier cache; token AES-256-GCM; service-role-only writes |
| `wa_templates` | Template mirror | Status webhook-driven; unique (`wa_connection_id`, name, language) |
| `wa_contacts` | Contacts | E.164 unique per workspace; `opt_in_source`, `opted_out` |
| `wa_audiences` / `wa_audience_members` | Segments | Membership snapshot materialized at enqueue |
| `wa_broadcasts` | Campaigns | `draft → approved → sending → sent/paused/cancelled/failed`; template + rendered-variable spec jsonb |
| `wa_outbound_queue` | Per-recipient sends | Deterministic idempotency key; claimed via `SKIP LOCKED` |
| `wa_send_log` | Messaging audit trail | **Append-only**; wamid, status transitions, error codes |
| `wa_inbound` | Inbound messages | Includes CTWA `referral` jsonb when present |

`supabase/schema.sql` remains idempotent — re-run after every schema change.

## 5. Security model

1. **Tokens:** ads tokens (~60d) and WABA business-integration tokens both AES-256-GCM encrypted (`TOKEN_ENCRYPTION_KEY`, 32 bytes, shared web+worker). Decryption only in `lib/meta.ts`, `lib/wa.ts` (web) and worker `crypto.ts`. Tokens never in URLs; redacted from all error strings.
2. **Tenancy:** RLS scopes every table to `workspace_id = auth.uid()`; webhook writes use the service role but resolve tenant strictly via `phone_number_id`/`waba_id` lookup — an event for an unknown number is dropped and logged, never guessed.
3. **Ads guardrails (deterministic):** create-paused defaults; 5x budget rule at execution time; explicit `activate`/`confirm_large_change` opt-ins; append-only `action_log`.
4. **Messaging guardrails (deterministic):** approved-template-only marketing sends; opt-out exclusion at enqueue and send; append-only `wa_send_log`. Broadcasts require an explicit human approval before anything enqueues.
5. **Webhooks:** Stripe — manual HMAC-SHA256, 5-min tolerance, `timingSafeEqual`. Shopify — optional HMAC (base64), same pattern. WhatsApp — `hub.verify_token` on subscribe + `X-Hub-Signature-256` (HMAC-SHA256 with the app secret) on every delivery, `timingSafeEqual`; unverified payloads rejected before parsing.
6. **Hosted MCP:** bearer keys stored as SHA-256 hashes; invalid keys → 401; tool errors redacted. WA send tools are not exposed via MCP in v2 (read-only surfaces only, if any).
7. **Dev mode:** `NEXT_PUBLIC_DEV_LOGIN=1` swaps auth + Meta + WA + DB for mocks. **Never in production** — it bypasses auth by design.

## 6. Deployment runbook (condensed; full steps in `adpilot/DEPLOY.md`)

**Order matters:**

1. **Supabase**: create project → run `schema.sql` → note URL + anon + service keys.
2. **Meta app**: Business-type app with **three** products: Facebook Login for Business, Marketing API, **WhatsApp**. Redirect URI `{APP_URL}/api/meta/oauth/callback`. Dev Mode = only app-role holders can connect (the beta program). Advanced Access needs Business Verification + App Review — the WA scopes (`whatsapp_business_management`, `whatsapp_business_messaging`) go through the same review as the ads scopes (`adpilot/APP_REVIEW.md`).
3. **WhatsApp webhook**: in the app dashboard, set callback `{APP_URL}/api/whatsapp/webhook` + verify token; subscribe to `messages`, `message_template_status_update`, `phone_number_quality_update`.
4. **Vercel**: import repo, Root Directory `adpilot/apps/web` (`vercel-build` builds shared packages first). Env matrix:

   | Var | web | worker (GH Actions) |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | ✅ | URL as `SUPABASE_URL` |
   | `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ |
   | `META_APP_ID` / `META_APP_SECRET` | ✅ | ✅ (webhook HMAC) |
   | `WA_EMBEDDED_SIGNUP_CONFIG_ID` | ✅ | — |
   | `WA_WEBHOOK_VERIFY_TOKEN` | ✅ | — |
   | `TOKEN_ENCRYPTION_KEY` | ✅ | ✅ **same value** |
   | `ANTHROPIC_API_KEY` | ✅ | ✅ |
   | `NEXT_PUBLIC_APP_URL` | ✅ | `APP_URL` var |
   | `RESEND_API_KEY` / `DIGEST_FROM_EMAIL` | — | optional |
   | `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | when billing | — |
   | `NEXT_PUBLIC_DEV_LOGIN` | **never** | **never** |

5. **Callbacks:** Supabase Site URL + `/auth/confirm`; Meta OAuth URI; Stripe webhook (3 events); WA webhook (step 3).
6. **Worker:** GH Actions — `audit-worker.yml` (nightly) + `wa-dispatcher.yml`. GH Actions cron is best-effort ≥5 min in practice, coarser than a true 1-minute dispatcher — fine for beta volumes; see the research item on moving the dispatcher off Actions before scale. Set secrets + `AUDIT_WORKER_ENABLED=true` / `WA_DISPATCHER_ENABLED=true`; test via manual dispatch.
7. **Smoke:** signup → Connect Meta → dashboard data → chat audit → approve a pause → Connect WhatsApp → sync templates → small test broadcast → verify delivery statuses land via webhook.

**Runtime notes:** chat route sets `maxDuration = 300` — needs Vercel Pro/Fluid for long agent turns. Webhook route must ack fast: verify signature, persist raw event, return 200 — Meta retries with backoff and eventually disables noisy webhooks.

## 7. Cost model

| Item | Estimate |
|---|---|
| Chat agent turn (Opus, ~3–6 tool calls) | ~$0.05–0.30 |
| Nightly audit per account | ~$0.10–0.40 |
| Infra (Vercel Pro + Supabase free tier + Actions) | ~$20–45/mo flat |
| WA platform cost to us | ~$0 marginal — messages bill to **the customer's WABA** (Meta charges per message, category-dependent; verify against the current rate card) |
| → Per-account COGS at daily audits | **~$3–12/mo** vs $99 price point; WA module adds queue-write pennies, not dollars |

Because message fees land on the tenant's own Meta billing, bulk messaging scales revenue without scaling our COGS — pricing can meter on broadcast volume/seats rather than pass-through message costs.

## 8. Known limitations & research items

**Correctness / product research**
- **Projections model** is a v1 power-law heuristic (exponent −0.15, ±20% band). Backtest against real account histories; consider per-vertical curves.
- **Budget minor-units** assume 100-subunit currencies; JPY/KRW etc. need a currency-exponent map.
- **Audit agent quality** unvalidated at scale — needs an eval set of real account snapshots before public launch.
- **Multi-connection workspaces**: MCP context and chat use the *first* connection/account; needs explicit account scoping UX (now applies to WABAs too).
- **`broadcast_draft` render tool**: scoped in this doc but not yet added to the live agent's tool list — the composer is manual-only in v2. Wiring it is a small, well-understood follow-up given the existing render-tool pattern.

**Platform / integration research**
- **Meta App Review** remains the launch gate; WA scopes add review surface — sequence one combined submission.
- **Dispatcher scheduling**: GH Actions cron is too coarse/jittery for minute-level draining at scale. Research: Supabase `pg_cron` + Edge Function, a small always-on worker (Fly/Railway), or a queue service. Actions is fine for beta volumes.
- **Rate limits**: ads worker audits serially (fine to ~100s of accounts); research header-driven backoff via `x-business-use-case-usage`. WA side: research auto-detection of tier upgrades to resume multi-day broadcasts early.
- **Hosted MCP**: stateless JSON-only; OAuth-wrapped endpoint still the research item.
- **CAPI relay**: Shopify-only; research refunds, other platforms, and the CTWA loop (inbound `referral` → lead-quality signal → CAPI event back to the originating ad).
- **Two-way agent inbox**: Claude-drafted replies inside the 24h window (suggest-then-approve first; auto-reply behind an explicit toggle much later).

**Compliance (WA-specific)**
- Marketing sends require documented opt-in; enforced at import (declared source) and enqueue (flag check). Research: double-opt-in via a utility template for imported lists.
- Opt-out keyword coverage beyond English — per-workspace configurable list is the target shape.
- Per-message pricing varies by template category — the composer should show estimated spend per broadcast before approval (not yet built).

**Hardening backlog (pre-GA)**
- Fail the production build if `NEXT_PUBLIC_DEV_LOGIN` is set.
- Rate-limit `/api/mcp`, the CAPI relay, and `/api/whatsapp/webhook` (per key/token/number).
- Rotate/expire MCP keys; scope read-only vs read-write.
- Encrypt `shopify_webhook_secret` at rest.
- Structured logging + Sentry on web and worker; alert on worker non-zero exits, webhook signature failures, and quality-rating drops.
- E2E suite (Playwright) against dev mode — the WA mock twin makes broadcast E2E cheap.
- Chaos test the dispatcher: kill mid-batch, verify idempotency keys prevent double sends.

## 9. Verification status (what's proven vs. pending)

| Area | Status |
|---|---|
| Builds (strict TS, all workspaces) | ✅ clean |
| OAuth flow, dashboards, launcher, approvals, MCP, relay | ✅ exercised end-to-end in dev mode (mock Meta) |
| Guardrails (5x rule via chat, queue, MCP) | ✅ verified rejecting + allowing correctly |
| Live Meta Graph calls | ✅ error path verified; happy path pending real token |
| Live Claude agent turns | ⚠ pending `ANTHROPIC_API_KEY` (fallback verified) |
| Resend / Stripe live flows | ⚠ pending keys (env-gated, clean errors verified) |
| WA connect, templates, contacts/audiences, broadcast pipeline, dispatcher | ✅ exercised end-to-end in dev mode (mock WA client) |
| WA webhook signature + tenant routing | ✅ verified against constructed test payloads (signature accept/reject, unknown-number drop) |
| Live WhatsApp sends / tier behavior | ⚠ pending Tech Provider approval + a real WABA |
