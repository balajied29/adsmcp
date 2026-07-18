# Meta App Review — Submission Guide

To manage strangers' ad accounts, the AdPilot Meta app needs **Advanced Access** to
`ads_read` and `ads_management` (and `business_management`). This is the longest
external lead time in the project — start Business Verification immediately; App
Review itself needs a working demo, which the app already provides.

## Sequence

### 1. Business Verification (do this first — days to weeks)

1. [business.facebook.com](https://business.facebook.com) → Settings → **Security Center** → Start Verification.
2. You'll need: legal business name, address, phone, and a document (registration
   certificate, utility bill, or bank statement matching the business name).
3. Verification must be on the Business Manager that **owns the Meta app**
   (App dashboard → App settings → Advanced → Business Manager).

### 2. Prerequisites on the app (all already built — just configure)

| Requirement | Where it stands |
|---|---|
| Privacy Policy URL | `https://YOUR_DOMAIN/privacy` — fill in the contact email TODOs first |
| Terms of Service URL | `https://YOUR_DOMAIN/terms` — same |
| App icon (1024×1024) + category | Create in App settings → Basic (category: Business) |
| Working OAuth flow on a public URL | Deploy `apps/web` (Vercel) and add the production redirect URI: `https://YOUR_DOMAIN/api/meta/oauth/callback` |
| Data deletion callback or instructions URL | Point to `/privacy` (it documents deletion) or implement `POST /api/meta/data-deletion` later |

### 3. Request Advanced Access

App dashboard → **App Review → Permissions and features**:

- `ads_read` → Request Advanced Access
- `ads_management` → Request Advanced Access
- `business_management` → Request Advanced Access

### 4. The submission form — what to write

**Use-case description (adapt):**

> AdPilot is an AI-assisted advertising management platform. Business owners
> connect their own Meta ad accounts via Facebook Login. AdPilot uses `ads_read`
> to display campaign performance dashboards and generate daily performance
> audits, and `ads_management` to execute changes the user explicitly approves —
> pausing underperforming campaigns, adjusting budgets, and launching new
> campaigns the user configures. Every change requires explicit per-action user
> approval in our UI, budget changes are limited by hard safety rules, and all
> actions are recorded in an audit log the user can review.

**Key points reviewers look for:**
- The permission is used **on behalf of the user for their own accounts** (never scraped/aggregated across users).
- Show the approval step — reviewers like seeing that writes are user-initiated.
- The demo must work with a **test user or reviewer-accessible account**.

### 5. Screencast (required)

Record one continuous flow, ~2–4 minutes, on the production URL:

1. Sign up / log in to AdPilot.
2. Click **Connect Meta** → complete the Facebook Login dialog (show the
   permissions screen — this is mandatory footage).
3. Dashboard: show campaigns + insights loading (`ads_read` in action).
4. Ask the agent for an audit → show the recommendations.
5. Approve one action (e.g. pause) → show it executed (`ads_management` in action).
6. Launch page: create a campaign **paused** → show it in Ads Manager.

Tips: use a clean test ad account with a few campaigns; narrate or subtitle each
permission as it's exercised; no dev-mode badge visible (unset `NEXT_PUBLIC_DEV_LOGIN`).

### 6. While waiting (Dev Mode)

Anyone with a **role on the app** (App roles → add as Developer/Tester) can use the
full OAuth flow with real ad accounts right now. That's the beta program: onboard
friendly users via roles, gather usage, iterate — App Review only gates strangers.

## Common rejection reasons → how this app avoids them

| Rejection | Mitigation |
|---|---|
| "Couldn't reproduce the use case" | Screencast on prod URL + test credentials in the submission notes |
| "Permission not needed" | Demo shows both read (dashboard) and write (approve→execute) paths |
| Privacy policy missing/insufficient | `/privacy` covers collection, use, deletion — fill in real contact + entity |
| Login dialog not shown | Screencast step 2 explicitly captures it |
| Broken redirect URI | Verify prod URI in Facebook Login settings before recording |

## After approval

- Switch the app from Dev Mode to **Live**.
- Rotate `META_APP_SECRET` if it was ever shared in screenshots/videos.
- Long-lived user tokens still expire (~60 days) — implement token refresh
  nudges (email when `token_expires_at` is near) or move to System User tokens
  for business-owned accounts.
