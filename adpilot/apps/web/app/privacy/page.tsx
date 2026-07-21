import Link from "next/link";

export const metadata = { title: "Privacy Policy — AP/S" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← AP/S
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: July 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-7 text-zinc-700">
        <p>
          AP/S connects to your Meta ad accounts, with your permission, to analyze
          and manage your advertising campaigns.
        </p>
        <section>
          <h2 className="font-semibold text-zinc-900">What we collect</h2>
          <p>
            Your email address (for sign-in), and — once you connect Meta — your ad
            account metadata, campaign structure, and performance metrics. Access
            tokens are encrypted at rest with AES-256.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-zinc-900">What we do with it</h2>
          <p>
            We use this data solely to provide the service: auditing performance,
            generating recommendations, and executing changes you approve. We do not
            sell your data or use it to train models.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-zinc-900">Data deletion</h2>
          <p>
            Disconnecting a Meta account deletes its stored token immediately.
            Deleting your AP/S account removes all associated data. You can also
            request deletion by email.
          </p>
        </section>
        <p className="text-zinc-500">
          {/* TODO: replace with your contact email and company details before App Review. */}
          Contact: privacy@yourdomain.com
        </p>
      </div>
    </main>
  );
}
