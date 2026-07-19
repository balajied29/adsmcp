# AdPilot — Product Marketing Brief

*For the whole team: what we built, who it's for, and how to talk about it.*
*Status: private beta · Last updated: July 2026*

---

## One-liner

**AdPilot is an AI media buyer for Meta Ads.** It launches campaigns, watches them 24/7, tells you exactly where money is being wasted — and fixes it with one click of your approval.

## The elevator pitch (30 seconds)

Small businesses spend $100–$10k/month on Meta ads with nobody really watching. Agencies charge $1–2k/month and check in weekly. AdPilot is the in-between that didn't exist: an AI agent that audits every campaign every morning, explains what it found in plain English with the arithmetic shown, and executes fixes the moment you approve them. It launches new campaigns from a chat message, projects what a budget will actually buy before you spend it, and keeps your conversion tracking healthy. Nothing goes live and no budget moves without explicit approval — the safety rules are enforced in code the AI cannot override.

## The problem

1. **Ads Manager is a full-time job.** Most SMB owners check it weekly at best; waste compounds daily.
2. **Waste is invisible until the invoice.** A bleeding ad set looks identical to a healthy one unless someone does the math.
3. **"AI ads tools" are black boxes.** Existing automation either does too little (rule-based alerts) or asks for blind trust (auto-spend with no explanation).
4. **Tracking silently breaks.** A dead pixel or missing Conversions API quietly ruins optimization for weeks.

## Who it's for

| Segment | Pain | Hook |
|---|---|---|
| **SMB / e-commerce owners** (primary) | No time, no expertise, real money burning | "Your AI media buyer. Audits daily. Never sleeps." |
| **Solo marketers / freelancers** | Managing several accounts manually | One dashboard, agent does the grunt work |
| **Small agencies** (later) | Junior-analyst work eats margin | The agent is the junior analyst |

## How it works (the demo flow — memorize this)

1. **Connect** — one-click Meta OAuth; AdPilot sees campaigns, spend, and results.
2. **Chat** — "Audit my account" → the agent pulls real data and returns a scored health card: what's strong, what's bleeding, and numbered fixes with the expected savings.
3. **Approve** — each fix is one click. Pause the loser, shift budget to the winner. Executed instantly, logged forever.
4. **Autopilot** — every morning the agent re-audits automatically and emails a digest; recommendations queue up for approval.
5. **Launch** — "Launch a campaign for more sales" → the agent drafts the whole setup from what already works in the account; one click opens it pre-filled in the launcher.

## Feature inventory (all live in beta)

**The agent**
- Chat-first dashboard — the product *is* the conversation
- Daily automated audits with health score, waste detection, creative-fatigue alerts
- Every recommendation shows its arithmetic ("CPA 3.4x your account average")
- Email digest with one link to the approval queue

**Deploy**
- Guided campaign launcher: objective → audience → placements → budget → creative
- Live interest search with audience sizes; include/exclude your customer lists
- Placement control: Advantage+ automatic or hand-picked (feed, stories, reels…)
- Audience size estimates from Meta before a dollar is committed
- Image upload for creatives; everything launches **paused** by default

**Projections**
- Budget slider: projected conversions, revenue, ROAS at any spend level
- Modeled from *the customer's own* last-30-day results, not industry averages
- Diminishing-returns math and honest ±20% ranges, methodology shown on-page

**Tracking**
- Pixel health monitoring (alerts when a pixel goes silent)
- Copy-paste install snippet; Shopify/Wix shortcuts
- One-click Conversions API test events
- **Shopify sales relay**: every order becomes a server-side, deduplicated Purchase event — tracking that survives ad blockers and iOS

**Power users**
- **AdPilot MCP connector**: customers can drive their AdPilot tools from Claude, Cursor, or any MCP client with a personal key — same guardrails apply

## Differentiators (our story vs. the field)

1. **Guardrails are code, not promises.** Budget changes >5x are blocked in software. Nothing launches live without an explicit opt-in. Every action lands in an audit log. The AI *cannot* override these — that sentence closes deals.
2. **Approval-first, autopilot-second.** Full autonomy is a setting customers graduate into, not a default they must trust on day one.
3. **Shows its work.** Every recommendation carries the math. No "our algorithm decided."
4. **Honest projections.** Ranges and methodology, built from the customer's own data. We say "projections, not promises" *on the page*.
5. **Open where others are closed.** The MCP connector makes AdPilot a platform, not a silo.

## Pricing

- **Private beta:** free (invite via Meta app roles).
- **At launch:** Pro **$99/mo** per workspace; beta users keep a discount. Unit economics: agent cost is cents-to-low-dollars per account/month — healthy margin at $99.

## Messaging pillars (approved copy)

- "Launch, track & scale ads. **Your AI does the babysitting.**"
- "Audits daily. Acts on approval. **Never sleeps.**"
- "**Guardrails are code, not promises.**"
- "Know what a budget buys **before you spend it.**"
- "Stop babysitting Ads Manager."

## Roadmap (external-safe version)

| Now (beta) | Next | Later |
|---|---|---|
| Meta Ads, full agent loop | Public launch after Meta App Review | Google Ads |
| Shopify sales relay | AI creative generation (copy variants → A/B) | TikTok Ads |
| MCP connector | Full autopilot mode (opt-in) | Agency multi-workspace |

## FAQ ammunition

- **"Is it safe to let an AI touch my ads?"** It can't touch them without you. Every change waits for your click, big budget moves need double confirmation, and there's a permanent log of everything.
- **"How is this different from Advantage+ / Meta's own AI?"** Meta optimizes *inside* the auction to spend your budget. AdPilot sits on *your* side: deciding what deserves budget at all, catching waste, and explaining itself.
- **"What data do you see?"** Only the ad accounts a customer connects, via Meta's official API, encrypted at rest. Disconnect and the token is deleted.
- **"Does it work with my store?"** Shopify today (sales relay). Any site can use the pixel + Conversions API tooling.
