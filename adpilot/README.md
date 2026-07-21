# AdPilot

AI media buyer SaaS for Meta ads — customers connect their ad accounts via OAuth, an agent audits performance daily, proposes actions, and executes approved changes with hard guardrails.

> Working name — rename by find/replace on `adpilot` / `AdPilot`.

## Monorepo layout

```
packages/meta-client/   Typed Meta Marketing API client (Graph v25.0) + OAuth helpers
packages/wa-client/     Typed WhatsApp Cloud API client (templates, sends, embedded signup)
apps/web/               Next.js 16 app: auth, Meta OAuth connect, chat dashboard,
                        launcher, approvals, WhatsApp module, MCP connector
apps/worker/            Daily audit agent + WhatsApp broadcast dispatcher
supabase/schema.sql     Postgres schema with RLS (16 tables — ads + WhatsApp)
```

## Milestone status

- [x] **M1 — Foundation:** signup/login (magic link), Connect Meta OAuth flow, encrypted token storage, dashboard with campaigns + 7-day insights
- [x] **M2 — Live agent:** Claude agent behind chat, daily audit worker → recommendations + email digest
- [x] **M3 — Approve & execute:** approval queue, guarded writes, action log
- [x] **M4 — Platform:** hosted MCP connector, Shopify CAPI relay, Stripe billing scaffold, WhatsApp module (templates, audiences, broadcasts, inbox) — App Review submission is the remaining external step (`APP_REVIEW.md`)

See `docs/TECHNICAL.md` (repo root) for the full architecture, security model, and open research items.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. SQL editor → paste and run `supabase/schema.sql`.
3. Authentication → Providers → make sure **Email** is enabled (magic links are the default).
4. Authentication → URL Configuration → set Site URL to `http://localhost:3000` (add your production URL later).
5. Project Settings → API: copy the URL, anon key, and service-role key.

### 2. Meta app

1. [developers.facebook.com/apps](https://developers.facebook.com/apps) → Create App → type **Business**.
2. Add the **Facebook Login for Business** product and the **Marketing API** product.
3. Facebook Login → Settings → **Valid OAuth Redirect URIs**: add
   `http://localhost:3000/api/meta/oauth/callback` (and later your production URL).
4. App settings → Basic: copy the **App ID** and **App Secret**.
5. While the app is in **Dev Mode**, only users with a role on the app (App roles → Roles) can connect — add yourself and your beta testers there. Public access requires App Review (Advanced Access for `ads_read`, `ads_management`) + Business Verification — start that process early.

### 3. Environment

```bash
cd apps/web
cp .env.example .env.local
# Fill in: Supabase keys, META_APP_ID, META_APP_SECRET,
# and TOKEN_ENCRYPTION_KEY from: openssl rand -hex 32
```

### 4. Run

```bash
npm install          # from the repo root
npm run dev:web      # http://localhost:3000
```

Sign in with a magic link → **Connect Meta** → approve the dialog → your ad accounts appear on the dashboard; click one for campaigns + last-7-day insights.

## Security model

- Meta tokens are AES-256-GCM encrypted before they touch the database; decryption happens only in `apps/web/lib/meta.ts` / the worker, never client-side.
- Row-level security scopes every table to the owning workspace; token reads/writes go through the service-role client on the server only.
- `action_log` is append-only — every write against Meta gets audited.
- Guardrails (spend caps, 5x budget rule, approval gates) are deterministic code in the worker, not LLM instructions.

## Deploy (suggested)

- **Web:** Vercel (set the env vars; update Supabase Site URL + Meta redirect URI to the production domain).
- **Worker:** Railway/Fly cron job running `npm run start -w apps/worker` daily.
