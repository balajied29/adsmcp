"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { LogoWordmark } from "@/app/logo";

function BackArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M13 8H3m0 0l4-4M3 8l4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });

    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#FAFAF9] p-6">
      {/* Ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] [background-size:32px_32px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-gradient-to-br from-blue-200/50 via-violet-200/40 to-transparent blur-3xl"
      />

      <Link
        href="/"
        className="absolute left-6 top-6 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-500 transition hover:bg-zinc-900/5 hover:text-zinc-900"
      >
        <BackArrowIcon />
        Back to home
      </Link>

      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl shadow-zinc-900/5">
        <LogoWordmark className="h-8 w-auto text-zinc-900" />
        <p className="mt-3 text-sm text-zinc-500">
          Sign in with a magic link — no password needed.
        </p>

        {process.env.NEXT_PUBLIC_DEV_LOGIN === "1" && (
          <a
            href="/dashboard"
            className="mt-6 block w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-center text-sm font-medium text-amber-800 transition hover:bg-amber-100"
          >
            Continue as dev (dummy data)
          </a>
        )}

        {status === "sent" ? (
          <p className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Check your inbox — we sent a sign-in link to <strong>{email}</strong>.
          </p>
        ) : (
          <form onSubmit={sendMagicLink} className="mt-6 space-y-3">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-zinc-600">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/5"
              />
            </div>
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        )}

        <p className="mt-6 text-center text-xs text-zinc-400">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline hover:text-zinc-600">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-zinc-600">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
