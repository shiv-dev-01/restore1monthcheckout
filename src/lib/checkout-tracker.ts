/**
 * Checkout tracking — posts visitor events to the Questflow tracker API.
 * All calls are fire-and-forget; they never block the UI.
 */

const API = "https://restord-questflow-tracker.lovable.app";

/** Resolve visitor_id from ?vid= URL param, falling back to sessionStorage. */
function getVisitorId(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get("vid");
  if (fromUrl) {
    // Persist so subsequent pages (no ?vid=) still resolve it.
    try { sessionStorage.setItem("rd_vid", fromUrl); } catch { /* ignore */ }
    return fromUrl;
  }
  try { return sessionStorage.getItem("rd_vid"); } catch { return null; }
}

export interface TrackCheckoutBody {
  status: "started" | "paid" | "failed" | "abandoned";
  name?: string;
  email?: string;
  phone?: string;
  amount?: number;
  currency?: string;
  order_ref?: string;
  payload?: Record<string, unknown>;
}

/** POST /api/public/track/checkout — fire-and-forget. */
export function trackCheckout(body: TrackCheckoutBody): void {
  const visitor_id = getVisitorId();
  if (!visitor_id) return;
  fetch(API + "/api/public/track/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ visitor_id, url: window.location.href, ...body }),
  }).catch(() => { /* never throw */ });
}

/** POST /api/public/track/event — fire-and-forget. */
export function trackEvent(event: string, step: string): void {
  const visitor_id = getVisitorId();
  if (!visitor_id) return;
  fetch(API + "/api/public/track/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ visitor_id, event, step }),
  }).catch(() => { /* never throw */ });
}
