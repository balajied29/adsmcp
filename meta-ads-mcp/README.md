# meta-ads-mcp

An MCP (Model Context Protocol) server that lets Claude read and manage your Meta (Facebook/Instagram) ad campaigns through the Marketing API (Graph API v25.0).

## Tools

**Read (reporting)**

| Tool | What it does |
|---|---|
| `list_ad_accounts` | Ad accounts the token can access |
| `list_campaigns` | Campaigns in an account (id, name, objective, status, budgets) |
| `list_adsets` | Ad sets in a campaign (targeting summary, budget, schedule) |
| `list_ads` | Ads in an ad set (creative name, status) |
| `get_insights` | Spend, impressions, clicks, CTR, CPC, CPM, reach, frequency, conversions, ROAS — at account/campaign/adset/ad level, with date presets or since/until and breakdowns (age, gender, placement, country) |
| `get_ad_creative` | Headline, body, link, CTA, image/video ids for an ad |

**Write (management)**

| Tool | What it does |
|---|---|
| `create_campaign` | New campaign — **created PAUSED by default** |
| `create_adset` | New ad set with budget, schedule, targeting — **created PAUSED by default** |
| `create_ad` | New ad from an existing creative or a new link creative — **created PAUSED by default** |
| `update_status` | Pause/resume a campaign, ad set, or ad |
| `update_budget` | Change daily/lifetime budget — increases >5x require `confirm_large_change: true` |

Safety rails: nothing goes live unless you explicitly pass `status: "ACTIVE"`; large budget jumps need an explicit confirmation flag; the access token is never logged and is redacted from error output. Budgets are always in **currency units** (e.g. `25.50` = $25.50) — the server converts to/from Meta's minor units (cents) internally.

## Setup

### 1. Create a Meta developer app

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) and log in with the Facebook account that has access to your ad account.
2. **Create App** → choose **Other** → app type **Business**. Name it (e.g. "Ads MCP") and create.
3. In the app dashboard, find **Add products** → **Marketing API** → **Set up**.
4. (Optional but recommended) Connect the app to your Business Manager under **App settings → Basic → Business verification** if you plan long-term use.

### 2. Generate a long-lived access token

1. Open the [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
2. Select your app in the **Meta App** dropdown.
3. Under **Permissions**, add `ads_read` and `ads_management` (add `business_management` too if your account lives in a Business Manager).
4. Click **Generate Access Token** and approve the login dialog. This gives you a **short-lived** token (~1–2 hours).
5. Exchange it for a **long-lived** token (~60 days):

   ```bash
   curl -G "https://graph.facebook.com/v25.0/oauth/access_token" \
     -d grant_type=fb_exchange_token \
     -d client_id=YOUR_APP_ID \
     -d client_secret=YOUR_APP_SECRET \
     -d fb_exchange_token=SHORT_LIVED_TOKEN
   ```

   The `access_token` in the response is your long-lived token. (App ID and secret are in **App settings → Basic**.)

   Alternative for permanent access: in Business Manager, create a **System User** (Business settings → Users → System users), assign it the ad account, and generate a token with `ads_read` + `ads_management` — system user tokens don't expire.

### 3. Find your ad account id

- Open [Ads Manager](https://adsmanager.facebook.com/) — the account id is in the URL as `act=1234567890`, and in the account dropdown at the top left.
- Prefix it with `act_`: e.g. `act_1234567890`.
- Or just run the smoke test below / call `list_ad_accounts` — both list every account the token can see.

### 4. Install and build

```bash
cd meta-ads-mcp
npm install
cp .env.example .env   # then fill in META_ACCESS_TOKEN and META_AD_ACCOUNT_ID
npm run build
```

### 5. Smoke test (before wiring up Claude)

```bash
npm run smoke
```

Expected output: your identity, plus a list of ad accounts. If this fails, fix the token/permissions before continuing — the error messages include hints (expired token, missing scopes, rate limits).

## Register the server

### Claude Code

```bash
claude mcp add meta-ads \
  --env META_ACCESS_TOKEN=YOUR_LONG_LIVED_TOKEN \
  --env META_AD_ACCOUNT_ID=act_1234567890 \
  -- node /absolute/path/to/meta-ads-mcp/dist/index.js
```

### Claude Desktop

Edit `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "meta-ads": {
      "command": "node",
      "args": ["/absolute/path/to/meta-ads-mcp/dist/index.js"],
      "env": {
        "META_ACCESS_TOKEN": "YOUR_LONG_LIVED_TOKEN",
        "META_AD_ACCOUNT_ID": "act_1234567890"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

## Verify inside Claude

Ask Claude: **"List my ad accounts."** It should call `list_ad_accounts` and return your account(s). Then try "Show me campaign performance for the last 7 days."

## Configuration reference

| Env var | Required | Description |
|---|---|---|
| `META_ACCESS_TOKEN` | ✅ | Long-lived token with `ads_read` + `ads_management` |
| `META_AD_ACCOUNT_ID` | — | Default account (`act_XXXX`) used when tools omit `account_id` |
| `META_API_VERSION` | — | Graph API version override (default `v25.0`) |

## Notes & troubleshooting

- **Token expired (code 190):** long-lived user tokens last ~60 days. Re-run the exchange in step 2, or switch to a non-expiring System User token.
- **Permission errors (code 10 / 200-series):** the token is missing `ads_read`/`ads_management`, or your user has no role on the ad account.
- **Rate limits (codes 4, 17, 32, 613, 80000+):** the server surfaces Meta's `x-business-use-case-usage` header in the error so you can see how close you are to the cap.
- Pagination is capped at 5 pages per list call to keep responses compact.
- Budget conversion assumes a 100-minor-unit currency (USD, EUR, GBP, …). For zero-decimal currencies (JPY, KRW, …) Meta already uses whole units — adjust `src/format.ts` if that's your account currency.
