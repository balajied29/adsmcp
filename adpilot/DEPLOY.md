# Deploying AdPilot

Two moving parts: the **web app** (Vercel) and the **audit worker** (GitHub Actions cron — already in the repo). Everything else is configuration.

## 1. Prerequisites (once)

- **Supabase project** — run `supabase/schema.sql` in the SQL editor (it's idempotent; re-run after schema changes).
- **Meta app** — created, with Facebook Login for Business + Marketing API products (see `README.md`).
- **Keys ready:** Supabase URL/anon/service-role, Meta App ID/Secret, `TOKEN_ENCRYPTION_KEY` (`openssl rand -hex 32` — the **same value** for web and worker), `ANTHROPIC_API_KEY`.

## 2. Web app → Vercel

1. [vercel.com/new](https://vercel.com/new) → import `balajied29/adsmcp`.
2. **Root Directory:** `adpilot/apps/web` (leave "Include files outside root" on — default). The repo's `vercel-build` script builds the shared `meta-client` package first; no custom build command needed.
3. **Environment variables:**

   | Variable | Notes |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase → Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | " |
   | `SUPABASE_SERVICE_ROLE_KEY` | " — server-only, never expose |
   | `META_APP_ID` / `META_APP_SECRET` | Meta app → Settings → Basic |
   | `TOKEN_ENCRYPTION_KEY` | 64 hex chars; same as worker |
   | `NEXT_PUBLIC_APP_URL` | `https://YOUR_DOMAIN` (set after first deploy if using the vercel.app URL) |
   | `ANTHROPIC_API_KEY` | enables the live chat agent |
   | `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | optional until billing goes live |

   ⚠️ **Never set `NEXT_PUBLIC_DEV_LOGIN` in production.**

4. Deploy, note the URL, then wire the callbacks:
   - **Supabase** → Authentication → URL Configuration: Site URL = prod URL; add `https://YOUR_DOMAIN/auth/confirm` to Redirect URLs.
   - **Meta app** → Facebook Login → Settings → Valid OAuth Redirect URIs: add `https://YOUR_DOMAIN/api/meta/oauth/callback`.
   - **Stripe** (when enabling billing) → Webhooks: `https://YOUR_DOMAIN/api/stripe/webhook`, events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`; copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

5. **Function duration:** agent chat turns can run past 60s. `maxDuration = 300` is set on the chat route — on the Hobby plan Vercel caps lower, so if long turns 504, either upgrade to Pro or enable Fluid Compute.

### Smoke test

Sign up with a real email → magic link lands → **Connect Meta** (your user must have a role on the Meta app while it's in Dev Mode) → ad accounts appear → open one → campaigns + insights load → chat: "Audit my account".

## 3. Audit worker → GitHub Actions (already committed)

`.github/workflows/audit-worker.yml` runs daily at 06:00 UTC. Enable it in the repo:

- **Settings → Secrets and variables → Actions → Variables:**
  - `AUDIT_WORKER_ENABLED` = `true` (the job is skipped until this exists)
  - `APP_URL` = `https://YOUR_DOMAIN` (used in digest links)
- **Secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, and optionally `RESEND_API_KEY` + `DIGEST_FROM_EMAIL` for email digests.

Test immediately via **Actions → Daily audit worker → Run workflow**. Accounts are audited only when `ad_accounts.managed = true` — flip that flag per account (an in-app toggle is a small follow-up; until then, set it in the Supabase table editor).

Alternative hosts if you outgrow Actions: Railway/Fly scheduled job running `node apps/worker/dist/index.js`.

## 4. After deploy

- Record the App Review screencast on the production URL (`APP_REVIEW.md`).
- Point a custom domain at Vercel and update `NEXT_PUBLIC_APP_URL`, Supabase, and Meta URIs.
- Rotate any key that ever appeared in a screenshot or screen recording.
