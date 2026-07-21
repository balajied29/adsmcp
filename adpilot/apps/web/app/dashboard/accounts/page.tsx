import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { devMode } from "@/lib/dev";
import { MOCK_ACCOUNTS, MOCK_CONNECTIONS } from "@/lib/mock-data";
import { ManagedToggle } from "./managed-toggle";

export const dynamic = "force-dynamic";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; connect_error?: string }>;
}) {
  const params = await searchParams;

  let connections: typeof MOCK_CONNECTIONS | null;
  let accounts: typeof MOCK_ACCOUNTS | null;

  if (devMode()) {
    connections = MOCK_CONNECTIONS;
    accounts = MOCK_ACCOUNTS;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    ({ data: connections } = await supabase
      .from("meta_connections")
      .select("id, fb_user_name, token_expires_at, created_at")
      .order("created_at"));

    ({ data: accounts } = await supabase
      .from("ad_accounts")
      .select("id, account_id, name, currency, status, connection_id, managed")
      .order("name"));
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Ad accounts</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Connected Meta identities and the accounts AP/S can see.
          </p>
        </div>
        <a
          href="/api/meta/oauth/start"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          {connections?.length ? "Reconnect Meta" : "Connect Meta"}
        </a>
      </header>

      {params.connect_error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Meta connection failed: {params.connect_error}
        </p>
      )}
      {params.connected && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          Meta account connected.
        </p>
      )}

      {!connections?.length ? (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
          No Meta account connected yet. Click <strong>Connect Meta</strong> to authorize
          AP/S to read and manage your ad accounts.
        </p>
      ) : (
        <>
          <ul className="mt-8 space-y-2">
            {connections.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm"
              >
                <span className="font-medium">{c.fb_user_name ?? "Meta user"}</span>
                {c.token_expires_at && (
                  <span className="text-xs text-zinc-400">
                    token expires {new Date(c.token_expires_at).toLocaleDateString()}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {accounts && accounts.length > 0 && (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {accounts.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/accounts/${a.id}`}
                    className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-400"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{a.name}</p>
                      <ManagedToggle
                        accountRowId={a.id}
                        initial={Boolean((a as { managed?: boolean }).managed)}
                      />
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {a.account_id} · {a.currency} ·{" "}
                      <span
                        className={
                          a.status === "ACTIVE" ? "text-emerald-600" : "text-amber-600"
                        }
                      >
                        {a.status}
                      </span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
