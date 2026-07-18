"use client";

import { useState } from "react";

/* ---------- Connector cards ---------- */

type Status = "connected" | "available" | "active" | "soon";

interface Connector {
  name: string;
  tile: { bg: string; fg: string; label: string };
  status: Status;
  connectHref?: string;
  disconnectAction?: string;
}

function connectors(metaConnected: boolean): Connector[] {
  return [
    {
      name: "Meta Ads",
      tile: { bg: "bg-blue-600", fg: "text-white", label: "∞" },
      status: metaConnected ? "connected" : "available",
      connectHref: "/api/meta/oauth/start",
      disconnectAction: "/api/meta/disconnect",
    },
    { name: "Google Ads", tile: { bg: "bg-white border border-zinc-200", fg: "text-blue-600", label: "G" }, status: "soon" },
    { name: "Google Analytics", tile: { bg: "bg-amber-500", fg: "text-white", label: "GA" }, status: "soon" },
    { name: "TikTok Ads", tile: { bg: "bg-zinc-900", fg: "text-white", label: "♪" }, status: "soon" },
    {
      name: "Creative Generation",
      tile: { bg: "bg-gradient-to-br from-violet-600 to-blue-600", fg: "text-white", label: "✦" },
      status: "active",
    },
    { name: "Shopify", tile: { bg: "bg-emerald-600", fg: "text-white", label: "S" }, status: "soon" },
    { name: "Instagram", tile: { bg: "bg-gradient-to-br from-pink-500 to-orange-400", fg: "text-white", label: "IG" }, status: "soon" },
    { name: "Google Search Console", tile: { bg: "bg-white border border-zinc-200", fg: "text-emerald-600", label: "SC" }, status: "soon" },
    { name: "Gmail", tile: { bg: "bg-red-500", fg: "text-white", label: "M" }, status: "soon" },
    { name: "Google Sheets", tile: { bg: "bg-emerald-700", fg: "text-white", label: "≡" }, status: "soon" },
    { name: "HubSpot", tile: { bg: "bg-orange-500", fg: "text-white", label: "H" }, status: "soon" },
    { name: "LinkedIn Ads", tile: { bg: "bg-sky-700", fg: "text-white", label: "in" }, status: "soon" },
  ];
}

function ConnectorCard({ c }: { c: Connector }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 ${
        c.status === "soon" ? "opacity-60" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl text-sm font-bold ${c.tile.bg} ${c.tile.fg}`}
        >
          {c.tile.label}
        </span>
        <span className="truncate text-sm font-semibold">{c.name}</span>
        {c.status === "active" && (
          <span className="h-2 w-2 flex-none rounded-full bg-emerald-500" title="Active" />
        )}
      </div>

      {c.status === "connected" && c.disconnectAction && (
        <form action={c.disconnectAction} method="post">
          <button
            type="submit"
            className="flex-none rounded-lg border border-emerald-500 px-4 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50"
          >
            Disconnect
          </button>
        </form>
      )}
      {c.status === "available" && c.connectHref && (
        <a
          href={c.connectHref}
          className="flex-none rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700"
        >
          Connect
        </a>
      )}
      {c.status === "soon" && (
        <span className="flex-none rounded-lg bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-400">
          Coming soon
        </span>
      )}
    </div>
  );
}

/* ---------- Setup guide ---------- */

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative mt-2">
      <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 pr-12 text-xs leading-5 text-zinc-700">
        {text}
      </pre>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute top-2.5 right-2.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-900"
      >
        {copied ? "✓" : "Copy"}
      </button>
    </div>
  );
}

const MCP_TOOLS = [
  ["list_ad_accounts", "Accounts the token can access"],
  ["list_campaigns", "Campaigns with budgets & status"],
  ["list_adsets", "Ad sets with targeting summary"],
  ["list_ads", "Ads with creative info"],
  ["get_insights", "Spend, CTR, CPC, ROAS + breakdowns"],
  ["get_ad_creative", "Headline, body, link, media"],
  ["create_campaign", "New campaign (paused by default)"],
  ["create_adset", "Budget, schedule, targeting"],
  ["create_ad", "From creative spec or existing id"],
  ["update_status", "Pause / resume any object"],
  ["update_budget", "Guarded — >5x needs confirmation"],
] as const;

const TABS = ["Claude Desktop", "Claude Code", "Cursor", "Tools"] as const;
type Tab = (typeof TABS)[number];

function SetupGuide() {
  const [tab, setTab] = useState<Tab>("Claude Desktop");

  return (
    <section className="mt-12">
      <h2 className="text-lg font-bold tracking-tight">30-second setup guide</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Use your AdPilot connections from any MCP client — Claude does the driving,
        AdPilot&apos;s guardrails still apply.
      </p>

      <div className="mt-5 rounded-2xl border border-zinc-200 bg-white">
        <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 px-4">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 px-4 py-3.5 text-sm font-medium transition ${
                tab === t
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-400 hover:text-zinc-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-6 text-sm leading-7 text-zinc-700">
          {tab === "Claude Desktop" && (
            <>
              <ol className="list-decimal space-y-1.5 pl-5">
                <li>
                  Open <strong>Claude Desktop</strong> → Settings → Developer →{" "}
                  <strong>Edit Config</strong>
                </li>
                <li>
                  Add the AdPilot MCP server to{" "}
                  <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
                    claude_desktop_config.json
                  </code>
                  :
                </li>
              </ol>
              <CopyBlock
                text={`{
  "mcpServers": {
    "adpilot-meta": {
      "command": "node",
      "args": ["/path/to/meta-ads-mcp/dist/index.js"],
      "env": {
        "META_ACCESS_TOKEN": "YOUR_LONG_LIVED_TOKEN",
        "META_AD_ACCOUNT_ID": "act_1234567890"
      }
    }
  }
}`}
              />
              <p className="mt-3 text-xs text-zinc-400">
                Restart Claude Desktop, then ask: “List my ad accounts.” A hosted
                connector URL (no local install) ships with the public beta.
              </p>
            </>
          )}

          {tab === "Claude Code" && (
            <>
              <p>One command — registers the server for every session:</p>
              <CopyBlock
                text={`claude mcp add adpilot-meta \\
  --env META_ACCESS_TOKEN=YOUR_LONG_LIVED_TOKEN \\
  --env META_AD_ACCOUNT_ID=act_1234567890 \\
  -- node /path/to/meta-ads-mcp/dist/index.js`}
              />
              <p className="mt-3 text-xs text-zinc-400">
                Then verify with “List my ad accounts” in a new session.
              </p>
            </>
          )}

          {tab === "Cursor" && (
            <>
              <p>
                Add to{" "}
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
                  ~/.cursor/mcp.json
                </code>
                :
              </p>
              <CopyBlock
                text={`{
  "mcpServers": {
    "adpilot-meta": {
      "command": "node",
      "args": ["/path/to/meta-ads-mcp/dist/index.js"],
      "env": {
        "META_ACCESS_TOKEN": "YOUR_LONG_LIVED_TOKEN",
        "META_AD_ACCOUNT_ID": "act_1234567890"
      }
    }
  }
}`}
              />
            </>
          )}

          {tab === "Tools" && (
            <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {MCP_TOOLS.map(([name, desc]) => (
                <div key={name} className="flex items-baseline gap-2.5 text-[13px]">
                  <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-800">
                    {name}
                  </code>
                  <span className="text-zinc-500">{desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- Page ---------- */

export function IntegrationsUI({ metaConnected }: { metaConnected: boolean }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          AdPilot MCP <span className="font-normal text-zinc-400">(Claude Connector)</span>
        </h1>
        <p className="text-sm text-zinc-400">Support: support@adpilot.app</p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {connectors(metaConnected).map((c) => (
          <ConnectorCard key={c.name} c={c} />
        ))}
      </div>

      <SetupGuide />
    </main>
  );
}
