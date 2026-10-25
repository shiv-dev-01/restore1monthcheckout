import { z } from "zod";

/**
 * Attribution keys forwarded from restoredelivered.com / the quiz into checkout.
 * The required Meta + Hyros pair is fbc_id + h_ad_id; the rest must stay intact
 * so the thank-you sale event can fire with the same payload.
 */
export const TRACKING_PARAM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_campaign_id",
  "utm_adset_name",
  "utm_adset_id",
  "utm_ad_name",
  "utm_ad_id",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
  "click_id",
  "fbc_id",
  "h_ad_id",
  "zlcid",
] as const;

export type TrackingParamKey = (typeof TRACKING_PARAM_KEYS)[number];
export type TrackingParams = Partial<Record<TrackingParamKey, string>>;

const STORAGE_KEY = "restore.checkout_tracking.v1";

/** TanStack JSON-parses query values (`utm_adset_id=12` → number). */
const searchString = z
  .union([z.string(), z.number(), z.boolean()])
  .optional()
  .transform((value) => (value === undefined ? undefined : String(value)));

/** Keeps known tracking keys (and any extras) on routes that validate search. */
export const trackingSearchSchema = z
  .object({
    utm_source: searchString,
    utm_medium: searchString,
    utm_campaign: searchString,
    utm_campaign_id: searchString,
    utm_adset_name: searchString,
    utm_adset_id: searchString,
    utm_ad_name: searchString,
    utm_ad_id: searchString,
    utm_content: searchString,
    utm_term: searchString,
    gclid: searchString,
    fbclid: searchString,
    click_id: searchString,
    fbc_id: searchString,
    h_ad_id: searchString,
    zlcid: searchString,
  })
  .passthrough();

export type TrackingSearch = TrackingParams & Record<string, unknown>;

export function parseTrackingSearch(search: unknown): TrackingSearch {
  return trackingSearchSchema.parse(search) as TrackingSearch;
}

function asParamString(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function readKey(source: unknown, key: string): unknown {
  if (!source) return undefined;
  if (source instanceof URLSearchParams) return source.get(key);
  if (typeof source === "string") {
    const query = source.startsWith("?") ? source.slice(1) : source;
    return new URLSearchParams(query).get(key);
  }
  if (typeof source === "object") {
    return (source as Record<string, unknown>)[key];
  }
  return undefined;
}

export function pickTrackingParams(source: unknown): TrackingParams {
  const out: TrackingParams = {};
  for (const key of TRACKING_PARAM_KEYS) {
    const value = asParamString(readKey(source, key));
    if (value) out[key] = value;
  }
  return out;
}

export function loadTrackingParams(): TrackingParams {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return pickTrackingParams(JSON.parse(raw));
  } catch {
    return {};
  }
}

function persist(params: TrackingParams) {
  if (typeof sessionStorage === "undefined") return;
  if (Object.keys(params).length === 0) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  } catch {
    // Ignore quota / private-mode failures; URL carry is the fallback.
  }
}

/** Merge URL (and any later hops) into sessionStorage. Later values win. */
export function captureTrackingParams(source?: unknown): TrackingParams {
  const fromWindow =
    typeof window !== "undefined" ? pickTrackingParams(window.location.search) : {};
  const merged: TrackingParams = {
    ...loadTrackingParams(),
    ...fromWindow,
    ...pickTrackingParams(source),
  };
  persist(merged);
  return merged;
}

/** Params to put on the next route / return URL. Empty keys omitted. */
export function trackingSearch(): TrackingParams {
  return captureTrackingParams();
}

export function withTrackingSearch<T extends object>(search: T): T & TrackingParams {
  return { ...trackingSearch(), ...search };
}

export function appendTrackingParams(
  url: URL,
  params: TrackingParams = trackingSearch(),
): URL {
  for (const key of TRACKING_PARAM_KEYS) {
    const value = params[key];
    if (value) url.searchParams.set(key, value);
  }
  return url;
}

/** createOrder_stripe start_url — includes fbc_id / h_ad_id when present. */
export function checkoutStartUrl(): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  const url = new URL(base, window.location.origin);
  appendTrackingParams(url);
  return url.toString();
}

/** Hyros ref_url: current page with stored tracking merged on. */
export function attributedUrl(href: string): string {
  try {
    const url = new URL(href);
    appendTrackingParams(url);
    return url.toString();
  } catch {
    return href;
  }
}
