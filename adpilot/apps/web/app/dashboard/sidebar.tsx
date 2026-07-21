"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavItem({
  href,
  label,
  soon,
  exact = false,
}: {
  href: string;
  label: string;
  soon?: boolean;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  if (soon) {
    return (
      <span className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-600">
        {label}
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
          soon
        </span>
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`block rounded-lg px-3 py-2 text-sm transition ${
        active
          ? "bg-zinc-800 font-medium text-white"
          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
      }`}
    >
      {label}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-6 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
      {children}
    </p>
  );
}

const RECENT_CHATS = [
  "Acme Store audit",
  "August sales push",
  "Lookalike deep-dive",
  "ROAS boost plan",
];

export function Sidebar({ dev, email }: { dev: boolean; email: string }) {
  return (
    <aside className="sticky top-0 flex h-screen w-60 flex-none flex-col bg-zinc-950 text-zinc-300">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2.5 px-4 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-sm font-bold text-zinc-900">
          A
        </span>
        <span className="text-lg font-semibold tracking-tight text-white">AdPilot</span>
        {dev && (
          <span className="ml-auto rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
            DEV
          </span>
        )}
      </Link>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <SectionLabel>Claude integration</SectionLabel>
        <NavItem href="/dashboard/integrations" label="Connect accounts" />
        <NavItem href="/dashboard/accounts" label="Live dashboards" />
        <NavItem href="#creatives" label="Creatives generation" soon />
        <NavItem href="#scheduling" label="Scheduling" soon />

        <SectionLabel>Paid ads</SectionLabel>
        <NavItem href="/dashboard" label="Agent chat" exact />
        <NavItem href="/dashboard/approvals" label="Approvals" />
        <NavItem href="/dashboard/accounts" label="Ad accounts" />
        <NavItem href="#autopilot" label="Marketing autopilot" soon />
        <NavItem href="#saved" label="Saved ads" soon />

        <SectionLabel>WhatsApp</SectionLabel>
        <NavItem href="/dashboard/whatsapp" label="Connections" />

        <SectionLabel>Workspace</SectionLabel>
        <NavItem href="/dashboard/integrations" label="Integrations" />
        <NavItem href="/dashboard/billing" label="Billing" />
        <NavItem href="#settings" label="Settings" soon />

        <SectionLabel>Recent chats</SectionLabel>
        {dev ? (
          RECENT_CHATS.map((c) => (
            <Link
              key={c}
              href="/dashboard"
              className="block truncate rounded-lg px-3 py-1.5 text-[13px] text-zinc-500 transition hover:bg-zinc-800/60 hover:text-zinc-300"
            >
              {c}
            </Link>
          ))
        ) : (
          <p className="px-3 py-1.5 text-[13px] italic text-zinc-600">No chats yet</p>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-800/80 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-zinc-300">{email}</p>
            <p className="text-[10px] text-zinc-600">Private beta</p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                <path
                  d="M12 3H7a2 2 0 00-2 2v10a2 2 0 002 2h5M13 13l3-3-3-3M16 10H8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
