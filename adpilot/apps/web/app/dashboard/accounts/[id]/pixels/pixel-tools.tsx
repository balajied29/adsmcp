"use client";

import { useState } from "react";
import type { Pixel } from "@adpilot/meta-client";

function pixelSnippet(pixelId: string): string {
  return `<!-- Meta Pixel -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/></noscript>
<!-- End Meta Pixel -->`;
}

export function PixelTools({
  accountRowId,
  pixels,
}: {
  accountRowId: string;
  pixels: Pixel[];
}) {
  const [selectedId, setSelectedId] = useState(pixels[0]!.id);
  const [copied, setCopied] = useState(false);
  const [testEventCode, setTestEventCode] = useState("");
  const [eventName, setEventName] = useState("PageView");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const selected = pixels.find((p) => p.id === selectedId) ?? pixels[0]!;

  async function copySnippet() {
    await navigator.clipboard.writeText(pixelSnippet(selected.id));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendTestEvent() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/accounts/${accountRowId}/pixels/test-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pixelId: selected.id,
          eventName,
          testEventCode: testEventCode || undefined,
        }),
      });
      const json = await res.json();
      setResult(
        res.ok
          ? {
              ok: true,
              text: `Meta received ${json.eventsReceived ?? 1} event(s).${testEventCode ? " Check Events Manager → Test Events to see it live." : ""}`,
            }
          : { ok: false, text: json.error },
      );
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSending(false);
    }
  }

  const lastFired = selected.lastFiredTime
    ? new Date(selected.lastFiredTime)
    : null;
  const staleDays = lastFired
    ? Math.floor((Date.now() - lastFired.getTime()) / 86_400_000)
    : null;

  return (
    <div className="mt-6 space-y-6">
      {/* Pixel list / health */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="font-semibold">Your pixels</h2>
        <ul className="mt-3 space-y-2">
          {pixels.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`flex w-full items-center justify-between rounded-xl border p-4 text-left text-sm ${
                  p.id === selectedId
                    ? "border-blue-500 bg-blue-50/50"
                    : "border-zinc-200 hover:border-zinc-400"
                }`}
              >
                <span>
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-xs text-zinc-400">{p.id}</span>
                </span>
                <span className="text-xs">
                  {p.isUnavailable ? (
                    <span className="text-red-600">unavailable</span>
                  ) : p.lastFiredTime ? (
                    <span className="text-emerald-600">
                      last event {new Date(p.lastFiredTime).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-amber-600">never fired</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {staleDays !== null && staleDays > 7 && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            This pixel hasn&apos;t fired in {staleDays} days — if your site has traffic,
            the install is probably broken. Reinstall the snippet below and send a test
            event.
          </p>
        )}
      </div>

      {/* Install snippet */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">1 · Install the pixel</h2>
          <button
            type="button"
            onClick={() => void copySnippet()}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            {copied ? "Copied ✓" : "Copy snippet"}
          </button>
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          Paste this into the <code className="rounded bg-zinc-100 px-1">&lt;head&gt;</code>{" "}
          of every page (or your tag manager). Shopify/Wix users: paste just the pixel id{" "}
          <code className="rounded bg-zinc-100 px-1">{selected.id}</code> into your
          platform&apos;s native Facebook Pixel field instead.
        </p>
        <pre className="mt-3 max-h-56 overflow-auto rounded-xl bg-zinc-900 p-4 text-xs leading-5 text-zinc-100">
          {pixelSnippet(selected.id)}
        </pre>
      </div>

      {/* CAPI */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="font-semibold">2 · Verify with the Conversions API</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          The Conversions API sends events server-to-server, so tracking survives ad
          blockers and iOS privacy limits. Fire a test event from AdPilot&apos;s servers
          to confirm the pipe works. To watch it arrive live, open Events Manager →
          your pixel → <strong>Test Events</strong>, copy the code shown (like{" "}
          <code className="rounded bg-zinc-100 px-1">TEST12345</code>), and paste it
          here.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Event
            </label>
            <select
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              {["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase", "Lead"].map(
                (e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ),
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Test event code (optional)
            </label>
            <input
              value={testEventCode}
              onChange={(e) => setTestEventCode(e.target.value)}
              placeholder="TEST12345"
              className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void sendTestEvent()}
            disabled={sending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send test event"}
          </button>
        </div>
        {result && (
          <p
            className={`mt-4 rounded-lg p-3 text-sm ${result.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
          >
            {result.text}
          </p>
        )}
      </div>
    </div>
  );
}
