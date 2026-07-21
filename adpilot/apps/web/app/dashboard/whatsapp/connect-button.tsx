"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        cb: (res: { authResponse?: { code?: string } }) => void,
        opts: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

/**
 * Drives Meta's Embedded Signup popup per the documented flow:
 * FB.login with the WhatsApp signup config → a `message` event on `window`
 * (type "WA_EMBEDDED_SIGNUP") carries { waba_id, phone_number_id } from the
 * signup session → the login callback's authResponse.code is the OAuth code
 * to exchange server-side. Requires META_APP_ID + a configured signup
 * config_id — falls back to a dev-only bypass otherwise.
 */
export function WhatsAppConnectButton({
  metaAppId,
  signupConfigId,
  devFallback,
}: {
  metaAppId: string | null;
  signupConfigId: string | null;
  devFallback: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "connecting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    if (!metaAppId || sdkReady) return;
    window.fbAsyncInit = () => {
      window.FB?.init({ appId: metaAppId, version: "v25.0", xfbml: false });
      setSdkReady(true);
    };
    if (document.getElementById("facebook-jssdk")) return;
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    document.body.appendChild(script);
  }, [metaAppId, sdkReady]);

  async function connectDev() {
    setStatus("connecting");
    const res = await fetch("/api/whatsapp/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "dev", wabaId: "dev", phoneNumberId: "dev" }),
    });
    if (res.ok) router.refresh();
    else {
      setStatus("error");
      setError("Dev connect failed");
    }
  }

  function connectLive() {
    if (!window.FB || !signupConfigId) return;
    setStatus("loading");
    setError(null);

    let sessionInfo: { wabaId?: string; phoneNumberId?: string } = {};
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith("facebook.com")) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === "WA_EMBEDDED_SIGNUP" && data.event === "FINISH") {
          sessionInfo = {
            wabaId: data.data?.waba_id,
            phoneNumberId: data.data?.phone_number_id,
          };
        }
      } catch {
        // non-JSON postMessage from an unrelated source — ignore
      }
    };
    window.addEventListener("message", onMessage);

    window.FB.login(
      async (res) => {
        window.removeEventListener("message", onMessage);
        const code = res.authResponse?.code;
        if (!code || !sessionInfo.wabaId || !sessionInfo.phoneNumberId) {
          setStatus("error");
          setError("Signup was cancelled or didn't complete.");
          return;
        }
        setStatus("connecting");
        try {
          const apiRes = await fetch("/api/whatsapp/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code,
              wabaId: sessionInfo.wabaId,
              phoneNumberId: sessionInfo.phoneNumberId,
            }),
          });
          const json = await apiRes.json();
          if (!apiRes.ok) throw new Error(json.error ?? "Connect failed");
          router.refresh();
        } catch (err) {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Connect failed");
        }
      },
      {
        config_id: signupConfigId,
        response_type: "code",
        override_default_response_type: true,
        extras: { feature: "whatsapp_embedded_signup" },
      },
    );
  }

  if (!metaAppId || !signupConfigId) {
    return devFallback ? (
      <button
        type="button"
        onClick={() => void connectDev()}
        disabled={status === "connecting"}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {status === "connecting" ? "Connecting…" : "Connect WhatsApp (dev)"}
      </button>
    ) : (
      <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
        WhatsApp connect isn&apos;t configured yet (missing signup config).
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={connectLive}
        disabled={!sdkReady || status === "loading" || status === "connecting"}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {status === "connecting"
          ? "Finishing setup…"
          : sdkReady
            ? "Connect WhatsApp"
            : "Loading…"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
