import Link from "next/link";

export const metadata = { title: "Terms of Service — AP/S" };

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← AP/S
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: July 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-7 text-zinc-700">
        <p>
          By using AP/S you authorize it to access and, only with your explicit
          approval, modify campaigns in the Meta ad accounts you connect.
        </p>
        <section>
          <h2 className="font-semibold text-zinc-900">Your responsibility</h2>
          <p>
            You remain responsible for your ad spend and for compliance with Meta&apos;s
            advertising policies. AP/S proposes changes; approved actions are
            executed on your behalf and logged.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-zinc-900">No guarantees</h2>
          <p>
            Recommendations are generated from your account&apos;s performance data.
            They are not guarantees of results, and the service is provided as-is
            during the beta.
          </p>
        </section>
        <p className="text-zinc-500">
          {/* TODO: replace with real legal terms and company details before launch. */}
          Contact: legal@yourdomain.com
        </p>
      </div>
    </main>
  );
}
