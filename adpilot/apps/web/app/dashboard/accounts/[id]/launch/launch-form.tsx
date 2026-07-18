"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { CustomAudience, InterestResult, Pixel } from "@adpilot/meta-client";

const OBJECTIVES = [
  ["OUTCOME_SALES", "Sales"],
  ["OUTCOME_LEADS", "Leads"],
  ["OUTCOME_TRAFFIC", "Traffic"],
  ["OUTCOME_ENGAGEMENT", "Engagement"],
  ["OUTCOME_AWARENESS", "Awareness"],
] as const;

const OPTIMIZATION_BY_OBJECTIVE: Record<string, [string, string][]> = {
  OUTCOME_SALES: [
    ["OFFSITE_CONVERSIONS", "Conversions (pixel)"],
    ["VALUE", "Purchase value (ROAS)"],
    ["LINK_CLICKS", "Link clicks"],
  ],
  OUTCOME_LEADS: [
    ["OFFSITE_CONVERSIONS", "Conversions (pixel)"],
    ["LEAD_GENERATION", "Lead forms"],
    ["LINK_CLICKS", "Link clicks"],
  ],
  OUTCOME_TRAFFIC: [
    ["LINK_CLICKS", "Link clicks"],
    ["LANDING_PAGE_VIEWS", "Landing page views"],
  ],
  OUTCOME_ENGAGEMENT: [["POST_ENGAGEMENT", "Post engagement"]],
  OUTCOME_AWARENESS: [["REACH", "Reach"]],
};

const FB_POSITIONS = ["feed", "story", "facebook_reels", "marketplace", "video_feeds", "search"];
const IG_POSITIONS = ["stream", "story", "reels", "explore", "profile_feed"];
const CTAS = ["LEARN_MORE", "SHOP_NOW", "SIGN_UP", "SUBSCRIBE", "CONTACT_US", "GET_OFFER"];

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500";
const labelCls = "block text-xs font-medium uppercase tracking-wide text-zinc-500";
const cardCls = "mt-6 rounded-2xl border border-zinc-200 bg-white p-6";

function Chip({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
      {children}
      <button type="button" onClick={onRemove} className="hover:text-blue-950">
        ×
      </button>
    </span>
  );
}

export function LaunchForm({
  accountRowId,
  currency,
  customAudiences,
  pixels,
  pages,
}: {
  accountRowId: string;
  currency: string;
  customAudiences: CustomAudience[];
  pixels: Pixel[];
  pages: { id: string; name: string }[];
}) {
  // Campaign
  const [campaignName, setCampaignName] = useState("");
  const [objective, setObjective] = useState<string>("OUTCOME_SALES");

  // Audience
  const [countries, setCountries] = useState("US");
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [genders, setGenders] = useState<"all" | "male" | "female">("all");
  const [interestQuery, setInterestQuery] = useState("");
  const [interestResults, setInterestResults] = useState<InterestResult[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<InterestResult[]>([]);
  const [includedAudiences, setIncludedAudiences] = useState<string[]>([]);
  const [excludedAudiences, setExcludedAudiences] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Placements
  const [autoPlacements, setAutoPlacements] = useState(true);
  const [platforms, setPlatforms] = useState<string[]>(["facebook", "instagram"]);
  const [fbPositions, setFbPositions] = useState<string[]>([]);
  const [igPositions, setIgPositions] = useState<string[]>([]);

  // Budget & schedule
  const [budgetType, setBudgetType] = useState<"daily" | "lifetime">("daily");
  const [budget, setBudget] = useState("");
  const [optimizationGoal, setOptimizationGoal] = useState("OFFSITE_CONVERSIONS");
  const [pixelId, setPixelId] = useState(pixels[0]?.id ?? "");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Creative
  const [pageId, setPageId] = useState(pages[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [headline, setHeadline] = useState("");
  const [cta, setCta] = useState("LEARN_MORE");
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageStatus, setImageStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [imageError, setImageError] = useState<string | null>(null);

  async function uploadImage(file: File) {
    setImageStatus("uploading");
    setImageError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/accounts/${accountRowId}/upload-image`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setImageHash(json.hash);
      setImageName(file.name);
      setImageStatus("idle");
    } catch (err) {
      setImageStatus("error");
      setImageError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  // Launch
  const [activate, setActivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const needsPixel = optimizationGoal === "OFFSITE_CONVERSIONS" || optimizationGoal === "VALUE";
  const countryList = useMemo(
    () =>
      countries
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter((c) => c.length === 2),
    [countries],
  );

  const audiencePayload = useCallback(
    () => ({
      countries: countryList,
      ageMin,
      ageMax,
      genders,
      interestIds: selectedInterests.map((i) => i.id),
      customAudienceIds: includedAudiences,
      excludedCustomAudienceIds: excludedAudiences,
    }),
    [countryList, ageMin, ageMax, genders, selectedInterests, includedAudiences, excludedAudiences],
  );

  const placementsPayload = useCallback(
    () =>
      autoPlacements
        ? undefined
        : {
            publisherPlatforms: platforms,
            facebookPositions: platforms.includes("facebook") ? fbPositions : [],
            instagramPositions: platforms.includes("instagram") ? igPositions : [],
          },
    [autoPlacements, platforms, fbPositions, igPositions],
  );

  function searchInterests(q: string) {
    setInterestQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) {
      setInterestResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const res = await fetch(
        `/api/accounts/${accountRowId}/interests?q=${encodeURIComponent(q)}`,
      );
      const json = await res.json();
      setInterestResults(json.interests ?? []);
    }, 350);
  }

  async function fetchEstimate() {
    setEstimate("Estimating…");
    const res = await fetch(`/api/accounts/${accountRowId}/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audience: audiencePayload(),
        placements: placementsPayload(),
        optimizationGoal,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setEstimate(`Estimate unavailable: ${json.error}`);
      return;
    }
    const lo = json.estimate?.monthlyActiveUsersLower;
    const hi = json.estimate?.monthlyActiveUsersUpper;
    setEstimate(
      lo || hi
        ? `Estimated audience: ${Number(lo ?? hi).toLocaleString()}${hi && lo ? ` – ${Number(hi).toLocaleString()}` : ""} monthly active people`
        : "Estimate not ready for this selection.",
    );
  }

  async function submit() {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/accounts/${accountRowId}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign: { name: campaignName, objective, specialAdCategories: [] },
          adset: {
            name: `${campaignName} — Ad set 1`,
            ...(budgetType === "daily"
              ? { dailyBudget: Number(budget) }
              : { lifetimeBudget: Number(budget) }),
            optimizationGoal,
            ...(needsPixel && pixelId ? { pixelId, customEventType: "PURCHASE" } : {}),
            ...(startTime ? { startTime: new Date(startTime).toISOString() } : {}),
            ...(endTime ? { endTime: new Date(endTime).toISOString() } : {}),
            audience: audiencePayload(),
            placements: placementsPayload(),
          },
          ad: {
            name: `${campaignName} — Ad 1`,
            pageId,
            message,
            link,
            headline: headline || undefined,
            imageHash: imageHash || undefined,
            callToAction: cta,
          },
          activate,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setResult({
          ok: false,
          text: `${json.error}${json.created?.campaignId ? ` (campaign ${json.created.campaignId} was created and is paused — review it in Ads Manager)` : ""}`,
        });
      } else {
        setResult({
          ok: true,
          text: `Launched ${json.status}: campaign ${json.campaignId}, ad set ${json.adsetId}, ad ${json.adId}.${json.status === "PAUSED" ? " Nothing will spend until you activate it." : " It will deliver once it passes ad review."}`,
        });
      }
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Launch failed" });
    } finally {
      setSubmitting(false);
    }
  }

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const canSubmit =
    campaignName.trim() &&
    countryList.length > 0 &&
    Number(budget) > 0 &&
    pageId &&
    message.trim() &&
    /^https?:\/\//.test(link) &&
    (!needsPixel || pixelId) &&
    (budgetType === "daily" || endTime);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {/* Campaign */}
      <section className={cardCls}>
        <h2 className="font-semibold">1 · Campaign</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Campaign name</label>
            <input
              className={`${inputCls} mt-1`}
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Summer Sale — Prospecting"
            />
          </div>
          <div>
            <label className={labelCls}>Objective</label>
            <select
              className={`${inputCls} mt-1`}
              value={objective}
              onChange={(e) => {
                setObjective(e.target.value);
                setOptimizationGoal(OPTIMIZATION_BY_OBJECTIVE[e.target.value]?.[0]?.[0] ?? "LINK_CLICKS");
              }}
            >
              {OBJECTIVES.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Audience */}
      <section className={cardCls}>
        <h2 className="font-semibold">2 · Audience</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Countries (ISO codes, comma-separated)</label>
            <input
              className={`${inputCls} mt-1`}
              value={countries}
              onChange={(e) => setCountries(e.target.value)}
              placeholder="US, CA, GB"
            />
          </div>
          <div>
            <label className={labelCls}>Age {ageMin}–{ageMax}</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={18}
                max={65}
                value={ageMin}
                onChange={(e) => setAgeMin(Number(e.target.value))}
                className={inputCls}
              />
              <input
                type="number"
                min={18}
                max={65}
                value={ageMax}
                onChange={(e) => setAgeMax(Number(e.target.value))}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Gender</label>
            <select
              className={`${inputCls} mt-1`}
              value={genders}
              onChange={(e) => setGenders(e.target.value as never)}
            >
              <option value="all">All</option>
              <option value="female">Women</option>
              <option value="male">Men</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className={labelCls}>Interests (live search)</label>
          <input
            className={`${inputCls} mt-1`}
            value={interestQuery}
            onChange={(e) => searchInterests(e.target.value)}
            placeholder="e.g. yoga, home improvement, small business owners…"
          />
          {interestResults.length > 0 && (
            <ul className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-zinc-200 bg-white text-sm shadow-sm">
              {interestResults.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-zinc-50"
                    onClick={() => {
                      if (!selectedInterests.some((s) => s.id === i.id)) {
                        setSelectedInterests([...selectedInterests, i]);
                      }
                      setInterestQuery("");
                      setInterestResults([]);
                    }}
                  >
                    <span>{i.name}</span>
                    {i.audienceSizeLower && (
                      <span className="text-xs text-zinc-400">
                        {Intl.NumberFormat("en", { notation: "compact" }).format(i.audienceSizeLower)}+
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedInterests.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedInterests.map((i) => (
                <Chip
                  key={i.id}
                  onRemove={() =>
                    setSelectedInterests(selectedInterests.filter((s) => s.id !== i.id))
                  }
                >
                  {i.name}
                </Chip>
              ))}
            </div>
          )}
        </div>

        {customAudiences.length > 0 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Include custom audiences</label>
              <div className="mt-1 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2 text-sm">
                {customAudiences.map((a) => (
                  <label key={a.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includedAudiences.includes(a.id)}
                      onChange={() => toggle(includedAudiences, setIncludedAudiences, a.id)}
                    />
                    <span className="truncate">{a.name}</span>
                    {a.approximateCount && (
                      <span className="ml-auto text-xs text-zinc-400">
                        ~{Intl.NumberFormat("en", { notation: "compact" }).format(a.approximateCount)}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Exclude (e.g. existing customers)</label>
              <div className="mt-1 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2 text-sm">
                {customAudiences.map((a) => (
                  <label key={a.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={excludedAudiences.includes(a.id)}
                      onChange={() => toggle(excludedAudiences, setExcludedAudiences, a.id)}
                    />
                    <span className="truncate">{a.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void fetchEstimate()}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            Estimate audience size
          </button>
          {estimate && <span className="text-sm text-zinc-600">{estimate}</span>}
        </div>
      </section>

      {/* Placements */}
      <section className={cardCls}>
        <h2 className="font-semibold">3 · Placements</h2>
        <div className="mt-4 flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={autoPlacements}
              onChange={() => setAutoPlacements(true)}
            />
            Advantage+ (automatic, recommended)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!autoPlacements}
              onChange={() => setAutoPlacements(false)}
            />
            Manual
          </label>
        </div>
        {!autoPlacements && (
          <div className="mt-4 space-y-4 text-sm">
            <div className="flex flex-wrap gap-3">
              {["facebook", "instagram", "audience_network", "messenger"].map((p) => (
                <label key={p} className="flex items-center gap-2 capitalize">
                  <input
                    type="checkbox"
                    checked={platforms.includes(p)}
                    onChange={() => toggle(platforms, setPlatforms, p)}
                  />
                  {p.replace("_", " ")}
                </label>
              ))}
            </div>
            {platforms.includes("facebook") && (
              <div>
                <p className={labelCls}>Facebook positions (empty = all)</p>
                <div className="mt-1 flex flex-wrap gap-3">
                  {FB_POSITIONS.map((p) => (
                    <label key={p} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={fbPositions.includes(p)}
                        onChange={() => toggle(fbPositions, setFbPositions, p)}
                      />
                      {p.replace(/_/g, " ")}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {platforms.includes("instagram") && (
              <div>
                <p className={labelCls}>Instagram positions (empty = all)</p>
                <div className="mt-1 flex flex-wrap gap-3">
                  {IG_POSITIONS.map((p) => (
                    <label key={p} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={igPositions.includes(p)}
                        onChange={() => toggle(igPositions, setIgPositions, p)}
                      />
                      {p.replace(/_/g, " ")}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Budget & optimization */}
      <section className={cardCls}>
        <h2 className="font-semibold">4 · Budget & optimization</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Budget type</label>
            <select
              className={`${inputCls} mt-1`}
              value={budgetType}
              onChange={(e) => setBudgetType(e.target.value as never)}
            >
              <option value="daily">Daily</option>
              <option value="lifetime">Lifetime</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Budget ({currency})</label>
            <input
              type="number"
              min="1"
              step="0.01"
              className={`${inputCls} mt-1`}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="50.00"
            />
          </div>
          <div>
            <label className={labelCls}>Optimize for</label>
            <select
              className={`${inputCls} mt-1`}
              value={optimizationGoal}
              onChange={(e) => setOptimizationGoal(e.target.value)}
            >
              {(OPTIMIZATION_BY_OBJECTIVE[objective] ?? []).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {needsPixel && (
          <div className="mt-4">
            <label className={labelCls}>Conversion pixel</label>
            {pixels.length ? (
              <select
                className={`${inputCls} mt-1 sm:max-w-xs`}
                value={pixelId}
                onChange={(e) => setPixelId(e.target.value)}
              >
                {pixels.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-sm text-amber-700">
                No pixel on this account — conversion optimization needs one. Set it up on
                the Pixels page, or optimize for link clicks instead.
              </p>
            )}
          </div>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Start (optional)</label>
            <input
              type="datetime-local"
              className={`${inputCls} mt-1`}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>
              End {budgetType === "lifetime" ? "(required)" : "(optional)"}
            </label>
            <input
              type="datetime-local"
              className={`${inputCls} mt-1`}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Creative */}
      <section className={cardCls}>
        <h2 className="font-semibold">5 · Creative</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Facebook Page</label>
            {pages.length ? (
              <select
                className={`${inputCls} mt-1`}
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
              >
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-sm text-amber-700">
                No Pages found — ads run from a Facebook Page. Make sure your Meta user
                has a role on one.
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Destination URL</label>
            <input
              className={`${inputCls} mt-1`}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://yourstore.com/sale"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className={labelCls}>Primary text</label>
          <textarea
            rows={3}
            className={`${inputCls} mt-1`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="The message people see above your ad…"
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Headline (optional)</label>
            <input
              className={`${inputCls} mt-1`}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Call to action</label>
            <select className={`${inputCls} mt-1`} value={cta} onChange={(e) => setCta(e.target.value)}>
              {CTAS.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className={labelCls}>Ad image (optional — JPEG/PNG/WebP, ≤8MB)</label>
          <div className="mt-1 flex items-center gap-3">
            <label className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50">
              {imageStatus === "uploading" ? "Uploading…" : imageHash ? "Replace image" : "Upload image"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={imageStatus === "uploading"}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadImage(f);
                  e.target.value = "";
                }}
              />
            </label>
            {imageHash && imageStatus !== "uploading" && (
              <span className="flex items-center gap-2 text-xs text-emerald-700">
                ✓ {imageName}
                <button
                  type="button"
                  onClick={() => {
                    setImageHash(null);
                    setImageName(null);
                  }}
                  className="text-zinc-400 hover:text-zinc-700"
                >
                  remove
                </button>
              </span>
            )}
            {!imageHash && imageStatus === "idle" && (
              <span className="text-xs text-zinc-400">
                Without an image, Meta uses the link preview.
              </span>
            )}
          </div>
          {imageError && <p className="mt-1 text-xs text-red-600">{imageError}</p>}
        </div>
      </section>

      {/* Launch */}
      <section className={cardCls}>
        <h2 className="font-semibold">6 · Launch</h2>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={activate}
            onChange={(e) => setActivate(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Set live immediately (starts real spend after ad review).
            <br />
            <span className="text-zinc-500">
              Unchecked (default): everything is created paused so you can review it in
              Ads Manager first.
            </span>
          </span>
        </label>
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 sm:w-auto sm:px-8"
        >
          {submitting ? "Launching…" : activate ? "Launch live" : "Create paused"}
        </button>
        {result && (
          <p
            className={`mt-4 rounded-lg p-3 text-sm ${result.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
          >
            {result.text}
          </p>
        )}
      </section>
    </form>
  );
}
