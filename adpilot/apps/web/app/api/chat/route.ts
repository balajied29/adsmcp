import { NextResponse, type NextRequest } from "next/server";
import type { AgentBlock } from "@/app/dashboard/chat-types";
import { devMode, DEV_USER } from "@/lib/dev";
import { createClient } from "@/lib/supabase/server";
import { metaClientForConnection } from "@/lib/meta";
import { MOCK_ACCOUNTS, createMockMetaClient } from "@/lib/mock-data";
import {
  agentCredentialsAvailable,
  runAgent,
  type AgentAccount,
  type HistoryTurn,
} from "@/lib/agent";

/**
 * Chat endpoint.
 * - With Anthropic credentials (ANTHROPIC_API_KEY): the live Claude agent —
 *   data tools read through the Meta client (mock in dev mode, live in prod),
 *   render tools emit the same typed blocks the UI draws.
 * - Without credentials: dev mode falls back to the scripted brain below so
 *   the UI stays fully designable offline.
 */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const maxDuration = 300; // agent turns can take a while

interface ChatRequestBody {
  message?: string;
  history?: HistoryTurn[];
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ChatRequestBody;
  const message = body.message ?? "";
  const history = (body.history ?? []).slice(-20); // cap context

  // Resolve who's asking + which account + which Meta client.
  let account: AgentAccount | null = null;
  let meta: ReturnType<typeof createMockMetaClient> | null = null;

  if (devMode()) {
    const a = MOCK_ACCOUNTS[0]!;
    account = { rowId: a.id, accountId: a.account_id, name: a.name, currency: a.currency };
    meta = createMockMetaClient();
    void DEV_USER;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: acct } = await supabase
      .from("ad_accounts")
      .select("id, account_id, name, currency, connection_id")
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (!acct) {
      return NextResponse.json({
        blocks: [
          {
            type: "text",
            text: "No ad account connected yet — head to **Integrations → Connect Meta** and I'll take it from there.",
          },
        ] satisfies AgentBlock[],
      });
    }
    account = { rowId: acct.id, accountId: acct.account_id, name: acct.name, currency: acct.currency };
    meta = await metaClientForConnection(acct.connection_id, user.id);
  }

  // Live agent path
  if (agentCredentialsAvailable()) {
    try {
      const blocks = await runAgent({ meta, account, message, history });
      return NextResponse.json({ blocks, live: true });
    } catch (err) {
      console.error("Agent error:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Agent failed" },
        { status: 502 },
      );
    }
  }

  // No credentials: scripted fallback in dev, honest message in prod.
  if (!devMode()) {
    return NextResponse.json({
      blocks: [
        {
          type: "text",
          text: "The live agent isn't configured on this deployment yet (missing ANTHROPIC_API_KEY).",
        },
      ] satisfies AgentBlock[],
    });
  }

  await delay(900 + Math.random() * 700);
  const m = message.toLowerCase();
  let blocks: AgentBlock[];
  if (/(audit|health|check|score|review)/.test(m)) {
    blocks = auditResponse(MOCK_ACCOUNTS[0]!.id);
  } else if (/(launch|create|new campaign|campaign|promote|bookings|sales push)/.test(m)) {
    blocks = campaignResponse(MOCK_ACCOUNTS[0]!.id);
  } else if (/(wast|leak|losing|bleed|burn)/.test(m)) {
    blocks = wasteResponse();
  } else if (/(budget|double|scale|spend more|projection|forecast)/.test(m)) {
    blocks = budgetResponse();
  } else {
    blocks = fallbackResponse();
  }
  return NextResponse.json({ blocks, live: false });
}

/* ---------------- Scripted fallback (dev without API key) ---------------- */

function auditResponse(accountRowId: string): AgentBlock[] {
  return [
    {
      type: "text",
      text: "I've audited **Acme Store — Main** (Meta Ads). Here's what I found:",
    },
    {
      type: "audit",
      accountName: "Acme Store — Main",
      accountRowId,
      channel: "Meta Ads",
      score: 72,
      fix: [
        "Lookalike 2% bleeding $402/mo",
        "Retargeting frequency at 2.2",
        "1 pixel silent for 9 days",
      ],
      strong: [
        "Prospecting ROAS at 3.4x",
        "CPCs 22% below niche median",
        "CAPI events flowing",
      ],
      summary:
        "You spent **$3,642** in the last 30 days and got **255 purchases** at **$14.30 each**. That's a **3.4x ROAS**. But **$640/mo is going to waste**.",
      biggestProblem: [
        "**“Lookalike 2% — Broad” is your money pit** — $402 spent in 30 days for 9 purchases at a **0.94x ROAS**. Every dollar in returns 94 cents.",
        "Your **Retargeting frequency hit 2.21** — people are seeing the same creative twice a week and CTR is starting to dip.",
      ],
      actions: [
        {
          title: "Pause “Lookalike 2% — Broad”",
          detail: "Saves $402/mo. Its CPA is 3.4x your account average with no trend improvement.",
          action: { kind: "pause_object", objectId: "23850000000000003" },
        },
        {
          title: "Raise Retargeting to $65/day",
          detail: "Your best performer at 5.87x ROAS with headroom (now $35/day) — est. +18 purchases/mo.",
          action: {
            kind: "budget_change",
            objectId: "23850000000000002",
            budgetType: "daily",
            amount: 65,
          },
        },
        {
          title: "Refresh Retargeting creative",
          detail: "Frequency 2.21 and climbing. A new variant resets fatigue before CTR craters.",
        },
        {
          title: "Fix the Landing Page Pixel",
          detail: "Silent for 9 days — you're flying blind on that funnel. Reinstall takes 5 minutes.",
        },
      ],
    },
    {
      type: "text",
      text: "Want me to apply any of these? Each one waits for your approval — nothing changes until you click.",
    },
  ];
}

function campaignResponse(accountRowId: string): AgentBlock[] {
  return [
    {
      type: "campaign",
      intro:
        "Got it. I've built a campaign for **Acme Store** to maximize sales this month, based on what's already working in your account.",
      title: "Acme Store — August Sales Push",
      stats: [
        { label: "Daily budget", value: "$85", sub: "$2,550/mo" },
        { label: "Est. clicks/mo", value: "12,700", sub: "Based on your $0.17 CPC" },
        { label: "Est. purchases", value: "148 – 212", sub: "At your $14.30 CPA ±20%" },
      ],
      rows: [
        ["Platform", "Meta (FB + IG)"],
        ["Objective", "Sales — optimize for Purchases"],
        ["Audience", "Yoga + Wellness interests, excl. past purchasers"],
        ["Est. audience size", "2.1M – 2.5M people"],
        ["Placements", "Advantage+ automatic"],
        ["Pixel", "Main Store Pixel → Purchase"],
        ["Landing page", "acmestore.com/sale"],
      ],
      launchHref: `/dashboard/accounts/${accountRowId}/launch`,
    },
    {
      type: "text",
      text: "The launcher is pre-wired for this account — tweak anything there. It creates everything **paused** so you get a final look before a dollar moves.",
    },
  ];
}

function wasteResponse(): AgentBlock[] {
  return [
    { type: "text", text: "Three places, in order of damage:\n" },
    {
      type: "text",
      text: "1. **“Lookalike 2% — Broad” — $402/mo at 0.94x ROAS.** 9 purchases from $402. Pause it or cut its budget 60% and let the algorithm re-learn.",
    },
    {
      type: "text",
      text: "2. **Retargeting fatigue — ~$85/mo of diminishing returns.** Frequency is 2.21 and CTR slipped from 4.1% to 3.6% over two weeks. A creative refresh recovers most of it.",
    },
    {
      type: "text",
      text: "3. **The silent Landing Page Pixel.** Not spend, but blindness — any conversions on that funnel aren't feeding optimization. That quietly inflates your measured CPA.",
    },
    {
      type: "text",
      text: "Total recoverable: about **$487/mo** plus better optimization data. Say **“audit my account”** for the full breakdown with one-click approvals.",
    },
  ];
}

function budgetResponse(): AgentBlock[] {
  return [
    {
      type: "text",
      text: "Right now you're at **$121/day** blended ($3,642 over 30 days) with a **3.38x ROAS**. Doubling to **$242/day** wouldn't double results — audiences saturate.",
    },
    {
      type: "text",
      text: "My model (your CPA, power-law diminishing returns): **~460 purchases/mo** (vs 255 today) at a projected **2.9–3.1x ROAS**. Revenue roughly **$21k → $36k/mo**. The smarter first move: shift the extra budget into Retargeting and Prospecting only — skip Lookalike until it's fixed.",
    },
    {
      type: "text",
      text: "Open **Projections** on the account page for the interactive slider, or tell me a target (e.g. “get me to 400 purchases/mo”) and I'll work backwards.",
    },
  ];
}

function fallbackResponse(): AgentBlock[] {
  return [
    { type: "text", text: "I manage your Meta ads end to end. Try:\n" },
    { type: "text", text: "· **“Audit my account”** — full health check with a score and one-click fixes" },
    { type: "text", text: "· **“Launch a campaign to get more sales”** — I'll draft the whole setup" },
    { type: "text", text: "· **“Where am I wasting spend?”** — ranked list of money leaks" },
    { type: "text", text: "· **“What if I doubled my budget?”** — projections from your own numbers" },
  ];
}
