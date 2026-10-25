/**
 * Lead answers for onboarding handoff + progressive n8n lead webhook
 * (same URL / pattern as nextvial_v1 and questionaire_restoredelivered).
 */

export type LeadAnswers = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  dob?: string;
  sex_at_birth?: string;
  state?: string;
  zip?: string;
  current_weight?: string | number;
  goal_weight?: string | number;
  height_ft?: string | number;
  height_in?: string | number;
  current_rx?: string;
  med_interest?: string | string[];
  medication_dose?: string;
  goal_outcomes?: string | string[];
  difficulty?: string | string[];
  glp1_history?: string | string[];
  prev_obstacle?: string | string[];
  start_timing?: string | string[];
  priorities?: string | string[];
  self_admin_comfort?: string | string[];
  experience_type?: string | string[];
  studio_interests?: string | string[];
  studio_history?: string | string[];
  plan?: string | number;
  comms?: string[];
  address?: string;
  address2?: string;
  city?: string;
  email_consent?: string;
  phone_sms_consent?: string;
  sms_prescription_consent?: string;
  [key: string]: unknown;
};

const LEAD_STORAGE_KEY = "restore_lead_answers_v1";
const ORIGINATING_URL_KEY = "restore_checkout_originating_url";
const WEBHOOK_FIRED_PAGES_KEY = "restore_checkout_webhook_fired_pages";

export const LEAD_WEBHOOK_URL =
  "https://n8n.whitelabelmd.com/webhook/f7e33dc8-c81c-4879-b36b-eafe07e02c65";

const SITE_ID = "393";

export function loadLeadAnswers(): LeadAnswers {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(LEAD_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LeadAnswers;
  } catch {
    return {};
  }
}

export function saveLeadAnswers(answers: LeadAnswers) {
  if (typeof sessionStorage === "undefined") return;
  const next = { ...loadLeadAnswers(), ...answers };
  sessionStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(next));
}

export function captureOriginatingUrl(): void {
  try {
    if (sessionStorage.getItem(ORIGINATING_URL_KEY)) return;
    sessionStorage.setItem(ORIGINATING_URL_KEY, window.location.href);
  } catch {
    /* ignore */
  }
}

function readFiredPages(): Set<string> {
  try {
    const raw = sessionStorage.getItem(WEBHOOK_FIRED_PAGES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function markPageFired(pageKey: string): void {
  try {
    const pages = readFiredPages();
    pages.add(pageKey);
    sessionStorage.setItem(
      WEBHOOK_FIRED_PAGES_KEY,
      JSON.stringify([...pages]),
    );
  } catch {
    /* ignore */
  }
}

export function isPageWebhookFired(pageKey: string): boolean {
  return readFiredPages().has(pageKey);
}

function asString(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (value == null) return "";
  return String(value).trim();
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** n8n/GHL webhook: contact + address only — quiz already owns the rest. */
function buildPayload(data: LeadAnswers): Record<string, string> {
  return {
    first_name: asString(data.first_name),
    last_name: asString(data.last_name),
    email: asString(data.email),
    phone: digitsOnly(asString(data.phone)),
    address: asString(data.address),
    address2: asString(data.address2),
    city: asString(data.city),
    zip: asString(data.zip),
    state: asString(data.state),
    site_id: SITE_ID,
  };
}

/**
 * Fire the n8n lead webhook once per page key this session.
 * Mirrors nextvial_v1 fireLeadWebhookForPage / fireCheckoutPageWebhook.
 */
export async function fireLeadWebhookForPage(
  pageKey: string,
  patch?: LeadAnswers,
): Promise<void> {
  if (!pageKey || isPageWebhookFired(pageKey)) return;

  markPageFired(pageKey);
  if (patch && Object.keys(patch).length > 0) {
    saveLeadAnswers(patch);
  }

  const data = loadLeadAnswers();
  const payload = buildPayload(data);
  if (!payload.email) return;

  try {
    await fetch(LEAD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* must not block checkout */
  }
}

/** Convenience for checkout routes: capture URL, merge contact, fire once. */
export function fireCheckoutPageWebhook(
  pageKey: string,
  contact?: LeadAnswers,
): void {
  captureOriginatingUrl();
  if (isPageWebhookFired(pageKey)) return;
  void fireLeadWebhookForPage(pageKey, contact);
}
