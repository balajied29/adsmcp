import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoGlyphA } from "@/app/logo";

export const dynamic = "force-dynamic";

/* ---------- Icons (inline SVG — no glyph fonts) ---------- */

function CheckIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path
        d="M3 8.5l3.2 3.2L13 5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white">
        <CheckIcon />
      </span>
      {children}
    </li>
  );
}

function CheckboxTile({ label, checked }: { label: string; checked: boolean }) {
  return (
    <span
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
        checked
          ? "border-blue-300 bg-blue-50 font-medium text-blue-700"
          : "border-zinc-200 bg-white text-zinc-400"
      }`}
    >
      <span
        className={`flex h-4 w-4 flex-none items-center justify-center rounded border ${
          checked ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-300 bg-white"
        }`}
      >
        {checked && <CheckIcon className="h-2.5 w-2.5" />}
      </span>
      {label}
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M3 8h10m0 0L9 4m4 4l-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------- Page ---------- */

const TICKER_ITEMS = [
  ["⏸", "Paused “Lookalike 2% — Broad”", "saving $312/wk"],
  ["↗", "Shifted $30/day to Retargeting", "ROAS 4.1x"],
  ["🎨", "Flagged creative fatigue", "frequency 4.2"],
  ["✓", "CAPI verified", "Purchase events flowing"],
  ["📊", "Audience estimated", "2.1M – 2.5M people"],
  ["🚀", "Launched “Summer Sale”", "created paused"],
  ["⚠", "Pixel silent 9 days", "install alert sent"],
  ["💰", "Budget cap enforced", "5x rule blocked a typo"],
] as const;

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const primaryCta = user ? "/dashboard" : "/login";

  return (
    <div className="flex flex-1 flex-col overflow-x-clip bg-[#FAFAF9] text-zinc-900">
      {/* Nav */}
      <nav className="sticky top-0 z-20 border-b border-zinc-200/70 bg-[#FAFAF9]/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-white">
              <LogoGlyphA className="h-3.5 w-3.5" />
            </span>
            <span>
              AP<span className="text-zinc-400">/</span>S
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <a href="#deploy" className="hidden text-zinc-600 hover:text-zinc-900 sm:block">
              Deploy
            </a>
            <a href="#projections" className="hidden text-zinc-600 hover:text-zinc-900 sm:block">
              Projections
            </a>
            <a href="#tracking" className="hidden text-zinc-600 hover:text-zinc-900 sm:block">
              Tracking
            </a>
            <a href="#safety" className="hidden text-zinc-600 hover:text-zinc-900 sm:block">
              Safety
            </a>
            {user ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700"
              >
                Open dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-zinc-600 hover:text-zinc-900">
                  Sign in
                </Link>
                <Link
                  href="/login"
                  className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative">
        {/* Gradient blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="hero-blob absolute -top-24 left-1/2 h-[480px] w-[480px] -translate-x-[70%] rounded-full bg-blue-400/25 blur-3xl" />
          <div className="hero-blob absolute top-10 left-1/2 h-[420px] w-[420px] translate-x-[10%] rounded-full bg-violet-400/20 blur-3xl [animation-delay:4s]" />
          <div className="hero-blob absolute top-64 left-1/2 h-[360px] w-[360px] -translate-x-1/4 rounded-full bg-cyan-300/20 blur-3xl [animation-delay:8s]" />
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-6 pt-20 pb-10 text-center sm:pt-28">
          <p className="anim-fade-up mx-auto flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-white/70 px-4 py-1.5 text-xs font-medium text-blue-700 shadow-sm backdrop-blur">
            <span className="relative flex h-2 w-2 items-center justify-center text-emerald-500">
              <span className="ping-dot relative h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Private beta — agent online, watching campaigns
          </p>
          <h1 className="anim-fade-up anim-delay-1 mx-auto mt-8 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
            Launch, track & scale ads.
            <br />
            <span className="text-gradient">Your AI does the babysitting.</span>
          </h1>
          <p className="anim-fade-up anim-delay-2 mx-auto mt-7 max-w-xl text-lg leading-8 text-zinc-600">
            Deploy Meta campaigns in minutes with curated audiences and hand-picked
            placements. See revenue projections before you spend. Get audited daily —
            approve fixes with one click.
          </p>
          <div className="anim-fade-up anim-delay-3 mt-9 flex items-center justify-center gap-3">
            <Link
              href={primaryCta}
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:shadow-xl hover:shadow-blue-600/40"
            >
              Connect your ad account
              <span className="transition-transform group-hover:translate-x-1">
                <ArrowIcon />
              </span>
            </Link>
            <a
              href="#deploy"
              className="rounded-xl border border-zinc-300 bg-white/80 px-7 py-3.5 text-sm font-medium text-zinc-700 backdrop-blur hover:bg-white"
            >
              See the platform
            </a>
          </div>

          {/* Dashboard mock with floating badges */}
          <div className="anim-fade-up anim-delay-4 relative mx-auto mt-20 max-w-4xl">
            <div className="anim-float absolute -top-6 -left-4 z-10 hidden rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-left shadow-xl shadow-emerald-500/10 sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                This week
              </p>
              <p className="text-lg font-bold text-zinc-900">+$312 saved</p>
            </div>
            <div className="anim-float-slow absolute -top-8 -right-6 z-10 hidden rounded-2xl border border-violet-200 bg-white px-4 py-3 text-left shadow-xl shadow-violet-500/10 sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">
                Blended ROAS
              </p>
              <p className="text-lg font-bold text-zinc-900">3.4x ↗</p>
            </div>
            <div className="anim-float-slow absolute -bottom-6 right-10 z-10 hidden rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-medium text-blue-700 shadow-lg sm:block [animation-delay:2.5s]">
              14 campaigns scanned · 6:00 AM
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-300/50">
              <div className="flex items-center gap-1.5 border-b border-zinc-100 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                <span className="ml-3 rounded-md bg-zinc-100 px-3 py-1 text-xs text-zinc-400">
                  aps.app/dashboard
                </span>
              </div>
              <div className="grid gap-4 p-6 text-left sm:grid-cols-[1fr_260px]">
                <div className="overflow-hidden rounded-xl border border-zinc-200">
                  <div className="grid grid-cols-4 gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    <span>Campaign</span>
                    <span className="text-right">Spend 7d</span>
                    <span className="text-right">CPA</span>
                    <span className="text-right">Status</span>
                  </div>
                  {[
                    ["Summer Sale — Prospecting", "$1,284", "$11.20", "ACTIVE", "text-emerald-600"],
                    ["Retargeting — 30d", "$642", "$6.90", "ACTIVE", "text-emerald-600"],
                    ["Lookalike 2% — Broad", "$918", "$38.75", "REVIEW", "text-amber-600"],
                    ["Old Creative Test", "$207", "$52.10", "PAUSED", "text-zinc-400"],
                  ].map(([name, spend, cpa, status, color]) => (
                    <div
                      key={name}
                      className="grid grid-cols-4 gap-2 border-b border-zinc-100 px-4 py-2.5 text-xs last:border-0"
                    >
                      <span className="truncate font-medium text-zinc-700">{name}</span>
                      <span className="text-right text-zinc-600">{spend}</span>
                      <span className="text-right text-zinc-600">{cpa}</span>
                      <span className={`text-right font-medium ${color}`}>{status}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                      Recommendation
                    </p>
                    <p className="mt-1 text-xs leading-5 text-emerald-900">
                      “Lookalike 2% — Broad” CPA is 3.4x your account average. Pause it
                      and shift $30/day to Retargeting.
                    </p>
                    <p className="mt-2 text-xs font-medium text-emerald-700">
                      Est. savings: $312/wk
                    </p>
                    <div className="mt-3 flex gap-2">
                      <span className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white">
                        Approve
                      </span>
                      <span className="rounded-md border border-emerald-300 px-3 py-1 text-[11px] font-medium text-emerald-700">
                        Dismiss
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      Last audit
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      Today 6:00 AM · 14 campaigns scanned · 2 findings
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live activity ticker */}
      <section className="marquee-mask mt-6 overflow-hidden border-y border-zinc-200 bg-white py-4">
        <div className="anim-marquee flex w-max gap-4">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map(([icon, action, detail], i) => (
            <span
              key={i}
              className="flex items-center gap-2 rounded-full border border-zinc-200 bg-[#FAFAF9] px-4 py-1.5 text-xs whitespace-nowrap"
            >
              <span>{icon}</span>
              <span className="font-medium text-zinc-800">{action}</span>
              <span className="text-zinc-400">·</span>
              <span className="text-zinc-500">{detail}</span>
            </span>
          ))}
        </div>
      </section>

      {/* Deploy */}
      <section id="deploy" className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-blue-600">01 — Deploy</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Launch campaigns in minutes,{" "}
            <span className="text-gradient">not mornings.</span>
          </h2>
          <p className="mt-4 leading-7 text-zinc-600">
            Campaign, audience, placements, budget, creative — one guided flow instead of
            forty Ads Manager screens. Everything launches paused for review unless you
            explicitly say go.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-zinc-700">
            <CheckItem>
              Curate audiences: live interest search with audience sizes, plus
              include/exclude your custom audiences
            </CheckItem>
            <CheckItem>
              Choose placements: Advantage+ automatic, or hand-pick feed, stories, reels
              and more per platform
            </CheckItem>
            <CheckItem>
              Audience size estimates from Meta before you commit a dollar
            </CheckItem>
          </ul>
        </div>
        {/* Wizard mock */}
        <div className="card-lift rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg shadow-zinc-200/50">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            2 · Audience
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["Yoga · 28M+", "Running · 94M+", "Wellness · 61M+"].map((c) => (
              <span
                key={c}
                className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
              >
                {c}
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden>
                  <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-200 bg-[#FAFAF9] px-3 py-2 text-xs text-zinc-400">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Search interests… “pilates”
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Exclude:{" "}
            <span className="font-medium text-zinc-700">Past purchasers (12,400)</span>
          </p>
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white">
              <CheckIcon className="h-2.5 w-2.5" />
            </span>
            Estimated audience: 2.1M – 2.5M monthly active people
          </p>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            3 · Placements
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <CheckboxTile label="Facebook feed" checked />
            <CheckboxTile label="Instagram reels" checked />
            <CheckboxTile label="Stories" checked />
            <CheckboxTile label="Audience Network" checked={false} />
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3">
            <span className="text-xs text-zinc-300">
              $50.00/day · optimize for Purchases
            </span>
            <span className="rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 px-3.5 py-1.5 text-xs font-semibold text-white">
              Create paused
            </span>
          </div>
        </div>
      </section>

      {/* Projections */}
      <section id="projections" className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2">
          {/* Projections mock */}
          <div className="card-lift order-2 rounded-2xl border border-zinc-200 bg-[#FAFAF9] p-5 shadow-lg shadow-zinc-200/50 lg:order-1">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold">If you spent…</p>
              <p className="text-2xl font-bold text-transparent [background:linear-gradient(90deg,#2563eb,#7c3aed)] bg-clip-text">
                $120<span className="text-xs font-normal">/day</span>
              </p>
            </div>
            <div className="mt-4 h-2 rounded-full bg-zinc-200">
              <div className="relative h-2 w-3/5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600">
                <span className="absolute -right-2 -top-1.5 h-5 w-5 rounded-full border-[3px] border-white bg-violet-600 shadow-md" />
              </div>
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-zinc-400">
              <span>$1/day</span>
              <span>current: $75/day</span>
              <span>$375/day</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
              {[
                ["Monthly spend", "$3,600"],
                ["Est. conversions", "252 – 378"],
                ["Est. revenue", "$9,900 – $14,800"],
                ["Est. ROAS", "2.7 – 4.1x"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-zinc-200 bg-white p-3">
                  <p className="text-zinc-500">{k}</p>
                  <p className="mt-0.5 text-sm font-bold text-zinc-900">{v}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-4 text-zinc-400">
              Modeled from your last 30 days (CPA $14.30, ROAS 3.4x) with diminishing
              returns applied above current spend.
            </p>
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-sm font-semibold text-violet-600">02 — Projections</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Know what a budget buys{" "}
              <span className="text-gradient">before you spend it.</span>
            </h2>
            <p className="mt-4 leading-7 text-zinc-600">
              Drag a slider, see the outcome: projected conversions, revenue, and ROAS at
              any daily budget — modeled from <em>your</em> account&apos;s real sales
              history, not industry averages.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-zinc-700">
              <CheckItem>Built on your actual CPA and ROAS from the last 30 days</CheckItem>
              <CheckItem>Diminishing-returns math when you scale past current spend</CheckItem>
              <CheckItem>Honest ranges, methodology shown — projections, not promises</CheckItem>
            </ul>
          </div>
        </div>
      </section>

      {/* Tracking */}
      <section id="tracking" className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-cyan-600">03 — Tracking</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Pixel + Conversions API,{" "}
            <span className="text-gradient">minus the headache.</span>
          </h2>
          <p className="mt-4 leading-7 text-zinc-600">
            Bad tracking quietly ruins good campaigns. AP/S watches your pixel&apos;s
            pulse, hands you the exact install snippet, and verifies your server-side
            Conversions API pipe with live test events.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-zinc-700">
            <CheckItem>Pixel health alerts — know within a day if events stop firing</CheckItem>
            <CheckItem>Copy-paste install snippet, or just the ID for Shopify &amp; Wix</CheckItem>
            <CheckItem>One-click CAPI test events you can watch arrive in Events Manager</CheckItem>
            <CheckItem>Conversion campaigns wired to the right pixel automatically</CheckItem>
          </ul>
        </div>
        {/* Pixel mock */}
        <div className="card-lift rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg shadow-zinc-200/50">
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-[#FAFAF9] p-4">
            <div>
              <p className="text-sm font-medium">Main Store Pixel</p>
              <p className="text-xs text-zinc-400">1053872649</p>
            </div>
            <span className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <span className="relative flex h-1.5 w-1.5 items-center justify-center text-emerald-500">
                <span className="ping-dot relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              firing · 2m ago
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div>
              <p className="text-sm font-medium text-amber-900">Landing Page Pixel</p>
              <p className="text-xs text-amber-700">silent for 9 days — install broken?</p>
            </div>
            <span className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800">
              Fix
            </span>
          </div>
          <div className="mt-3 rounded-xl bg-zinc-900 p-4">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">
              Conversions API — test event
            </p>
            <p className="mt-2 font-mono text-xs text-emerald-400">
              → POST /events · Purchase · TEST7241
            </p>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-zinc-300">
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-zinc-900">
                <CheckIcon className="h-2 w-2" />
              </span>
              events_received: 1 · visible in Events Manager
            </p>
          </div>
        </div>
      </section>

      {/* Autopilot grid */}
      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <p className="text-center text-sm font-semibold text-emerald-600">
            04 — Autopilot
          </p>
          <h2 className="mt-2 text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            Then the agent takes over
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-zinc-600">
            Once your campaigns are live, it watches them every day so you don&apos;t
            have to.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["💸", "Wasted spend", "Ad sets burning budget above your target CPA get flagged the day it happens — not at month end."],
              ["🎨", "Creative fatigue", "Rising frequency and falling CTR trigger a refresh recommendation before performance craters."],
              ["⚖️", "Budget reallocation", "Winners get more, losers get less — proposed with the math shown, capped by your rules."],
              ["🚨", "Anomaly alerts", "Spend spikes, delivery drops, and disapproved ads surface in your inbox, not next week's report."],
              ["🛎️", "Approval queue", "Every action waits for your click. Full autopilot is a setting you graduate into, not a default."],
              ["📜", "Audit log", "Every change AP/S ever makes is recorded — who approved it, what changed, and what happened."],
            ].map(([icon, title, body]) => (
              <div
                key={title}
                className="card-lift rounded-2xl border border-zinc-200 bg-[#FAFAF9] p-6"
              >
                <span className="text-2xl">{icon}</span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Safety */}
      <section id="safety" className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-900 p-8 text-white sm:p-14">
          <div
            className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl"
            aria-hidden
          />
          <div className="relative grid gap-10 sm:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Guardrails are code,
                <br />
                <span className="text-gradient">not promises.</span>
              </h2>
              <p className="mt-4 text-zinc-400">
                An AI touching your ad budget needs hard limits. AP/S&apos;s safety
                rules are enforced in software the AI cannot override.
              </p>
            </div>
            <ul className="space-y-4 text-sm leading-6 text-zinc-200">
              {[
                "Campaigns launch paused unless you explicitly set them live.",
                "Budget increases over 5x require explicit confirmation — always.",
                "Nothing is ever changed without your approval.",
                "Access tokens are AES-256 encrypted; disconnect any time and they're gone.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white">
                    <CheckIcon />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-28">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-violet-600 to-blue-700 px-8 py-16 text-center text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_30%,white_1px,transparent_1px),radial-gradient(circle_at_80%_70%,white_1px,transparent_1px)] [background-size:48px_48px]"
            aria-hidden
          />
          <h2 className="relative text-3xl font-semibold tracking-tight sm:text-5xl">
            Stop babysitting Ads Manager.
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-blue-100">
            Connect your Meta account, launch your first campaign, and get your first
            audit within a day.
          </p>
          <Link
            href={primaryCta}
            className="group relative mt-9 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-blue-700 shadow-lg transition hover:shadow-2xl"
          >
            Get started free
            <span className="transition-transform group-hover:translate-x-1">
              <ArrowIcon />
            </span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8 text-sm text-zinc-500">
          <span>© {new Date().getFullYear()} AP/S</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-zinc-800">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-zinc-800">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
