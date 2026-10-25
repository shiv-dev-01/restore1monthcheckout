import { checkoutStartUrl } from "@/lib/tracking-params";

export type ProductId = "semaglutide" | "tirzepatide";
export type PlanId = "12" | "6" | "3" | "1";

/** Single source of truth for WhiteLabelMD / Restore Delivered APIs. */
export const PRICING_APIS = {
  semaglutide: "https://panel.whitelabelmd.com/restoredelivered/api/get_all_sema",
  tirzepatide: "https://panel.whitelabelmd.com/restoredelivered/api/get_all_tirz",
} as const satisfies Record<ProductId, string>;

export const CREATE_ORDER_API =
  "https://panel.whitelabelmd.com/restoredelivered/api/createOrder_test";

/** Stripe checkout order create (payment_token = Stripe PaymentIntent id). */
export const CREATE_ORDER_STRIPE_API =
  "https://panel.whitelabelmd.com/restoredelivered/api/createOrder_stripe";

/**
 * Stripe PaymentIntent endpoint.
 * - Dev / preview: local Vite middleware (uses STRIPE_SECRET_KEY from .env)
 * - Production build: WhiteLabelMD panel API (override with VITE_STRIPE_PAYMENT_INTENT_API)
 */
export const CREATE_PAYMENT_INTENT_API = "https://panel.whitelabelmd.com/restoredelivered/api/stripe/create-payment-intent";

export const CHECK_COUPONS_API =
  "https://panel.whitelabelmd.com/wlmdbackend/api/check_coupons_v3";

/** Fired only after a successful order that used a coupon. */
export const COUPON_ORDER_WEBHOOK_API =
  "https://n8n.whitelabelmd.com/webhook/c8d83310-f173-401d-8555-08795624cc92";

/** Restore Delivered site id (same role as SITE_ID in koverx_checkout). */
export const COUPON_SITE_ID = 393;

export type PricingApiProduct = {
  product_id: number;
  product_name: string;
  price: string;
  sku: string;
  category_name: string;
  image: string | null;
};

export type PricingApiResponse = {
  status: number;
  message: string;
  data: PricingApiProduct[];
};

export type PlanTotals = Record<ProductId, Record<PlanId, number>>;
export type ProductCatalog = Record<ProductId, Partial<Record<PlanId, PricingApiProduct>>>;

export type PricingBundle = {
  planTotals: PlanTotals;
  products: ProductCatalog;
};

/** Hardcoded 1-month product ids + prices for this checkout. */
const ONE_MONTH: Record<ProductId, { product_id: number; price: number }> = {
  semaglutide: { product_id: 69, price: 99 },
  tirzepatide: { product_id: 70, price: 145 },
};

/** Used while loading or if an API call fails. */
export const FALLBACK_PLAN_TOTALS: PlanTotals = {
  semaglutide: { "12": 1188, "6": 714, "3": 399, "1": ONE_MONTH.semaglutide.price },
  tirzepatide: { "12": 1788, "6": 1074, "3": 589, "1": ONE_MONTH.tirzepatide.price },
};

function hardcodeOneMonthProduct(
  existing: PricingApiProduct | undefined,
  product: ProductId,
): PricingApiProduct {
  return {
    product_id: ONE_MONTH[product].product_id,
    product_name: existing?.product_name ?? "1 Month",
    price: String(ONE_MONTH[product].price),
    sku: existing?.sku ?? "",
    category_name: existing?.category_name ?? "",
    image: existing?.image ?? null,
  };
}

export const HARDCODED_ONE_MONTH_PRODUCTS: ProductCatalog = {
  semaglutide: { "1": hardcodeOneMonthProduct(undefined, "semaglutide") },
  tirzepatide: { "1": hardcodeOneMonthProduct(undefined, "tirzepatide") },
};

function planIdFromProduct(product: PricingApiProduct): PlanId {
  const name = product.product_name.toLowerCase();
  if (name.includes("12 month")) return "12";
  if (name.includes("6 month")) return "6";
  if (name.includes("3 month")) return "3";
  return "1";
}

function mapProducts(
  products: PricingApiProduct[],
  fallback: Record<PlanId, number>,
): { totals: Record<PlanId, number>; byPlan: Partial<Record<PlanId, PricingApiProduct>> } {
  const totals = { ...fallback };
  const byPlan: Partial<Record<PlanId, PricingApiProduct>> = {};
  for (const product of products) {
    const planId = planIdFromProduct(product);
    const price = Number.parseFloat(product.price);
    if (Number.isFinite(price)) totals[planId] = price;
    byPlan[planId] = product;
  }
  return { totals, byPlan };
}

async function fetchPricingProducts(url: string): Promise<PricingApiProduct[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Pricing API failed (${res.status}): ${url}`);
  }
  const json = (await res.json()) as PricingApiResponse;
  if (json.status !== 1 || !Array.isArray(json.data)) {
    throw new Error(json.message || "Pricing API returned an unexpected payload");
  }
  return json.data;
}

/**
 * Fetches live plan prices from the browser (same pattern as createOrder /
 * the existing Restore Delivered SPA checkouts that sir deploys from Drive).
 */
export async function getPricingBundle(): Promise<PricingBundle> {
  const [sema, tirz] = await Promise.all([
    fetchPricingProducts(PRICING_APIS.semaglutide),
    fetchPricingProducts(PRICING_APIS.tirzepatide),
  ]);

  const semaMapped = mapProducts(sema, FALLBACK_PLAN_TOTALS.semaglutide);
  const tirzMapped = mapProducts(tirz, FALLBACK_PLAN_TOTALS.tirzepatide);

  semaMapped.totals["1"] = ONE_MONTH.semaglutide.price;
  tirzMapped.totals["1"] = ONE_MONTH.tirzepatide.price;
  semaMapped.byPlan["1"] = hardcodeOneMonthProduct(semaMapped.byPlan["1"], "semaglutide");
  tirzMapped.byPlan["1"] = hardcodeOneMonthProduct(tirzMapped.byPlan["1"], "tirzepatide");

  return {
    planTotals: {
      semaglutide: semaMapped.totals,
      tirzepatide: tirzMapped.totals,
    },
    products: {
      semaglutide: semaMapped.byPlan,
      tirzepatide: tirzMapped.byPlan,
    },
  };
}

/** Payload for createOrder_stripe. */
export type CreateStripeOrderPayload = {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  address2?: string;
  city_name: string;
  state_name: string;
  zip_code: string;
  start_url: string;
  /** Stripe PaymentIntent id (pi_...). */
  payment_token: string;
  product_id: number[];
  billingSameAsShipping: "YES" | "NO";
  promo_codes: string | null;
  billing_address?: string;
  billing_address2?: string;
  billing_city_name?: string;
  billing_state_name?: string;
  billing_zip_code?: string;
};

export type CreateOrderResult = {
  status: number;
  message?: string;
  /** createOrder_stripe success shape */
  success_orders?: Array<string | number>;
  failed_orders?: Array<string | number>;
  /** legacy createOrder_test field */
  order_id?: string | number;
};

/** First successful order id from createOrder_stripe (or legacy order_id). */
export function orderIdFromCreateOrderResult(
  result: CreateOrderResult | null | undefined,
): string | null {
  if (!result) return null;
  const fromSuccess = result.success_orders?.[0];
  if (fromSuccess != null && String(fromSuccess).trim()) {
    return String(fromSuccess).trim();
  }
  if (result.order_id != null && String(result.order_id).trim()) {
    return String(result.order_id).trim();
  }
  return null;
}

export type CheckCouponsPayload = {
  site_id: number;
  promo_codes: string;
  /** Single id or comma-separated ids (e.g. "3,5,8") — matches koverx_checkout. */
  product_id: string | number;
  email: string;
};

export type CheckCouponsResult = {
  status: number;
  message?: string;
  discount_percent?: string | number;
  discount_amount?: string | number;
  data?: {
    code?: string;
    discount_percent?: string | number;
    discount_amount?: string | number;
  };
};

/** Parse API money/percent strings that may include thousand separators (e.g. "1,176.12"). */
function parseCouponNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null || value === "") return 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Reads percent/amount from top-level or nested `data` (koverx check_coupons_v3 shape). */
function couponDiscountFields(result: CheckCouponsResult | null | undefined) {
  if (!result) return { percent: 0, amount: 0 };
  return {
    percent: parseCouponNumber(
      result.discount_percent ?? result.data?.discount_percent,
    ),
    amount: parseCouponNumber(
      result.discount_amount ?? result.data?.discount_amount,
    ),
  };
}

/** Computes dollar discount from a successful check_coupons_v3 response. */
export function couponDiscountFromResult(
  result: CheckCouponsResult | null | undefined,
  subtotal: number,
): number {
  if (!result || result.status !== 1) return 0;
  const { percent, amount } = couponDiscountFields(result);
  if (percent > 0) {
    return Math.max(0, (subtotal * percent) / 100);
  }
  if (amount > 0) {
    return Math.max(0, amount);
  }
  return 0;
}

/** Applied promo code string from a successful response (prefers nested `data.code`). */
export function couponCodeFromResult(
  result: CheckCouponsResult | null | undefined,
  fallback: string,
): string {
  const fromData = result?.data?.code;
  if (typeof fromData === "string" && fromData.trim()) return fromData.trim();
  return fallback.trim();
}

/**
 * Validates a promo code via WhiteLabelMD check_coupons_v3
 * (same endpoint + payload shape as koverx_checkout).
 */
export async function checkCoupons(
  payload: CheckCouponsPayload,
): Promise<CheckCouponsResult> {
  const res = await fetch(CHECK_COUPONS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Coupon API failed (${res.status})`);
  }

  return (await res.json()) as CheckCouponsResult;
}

/** Builds the createOrder_stripe payload from checkout session + PaymentIntent id. */
export function buildStripeOrderPayload(
  session: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    address?: string;
    address2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    billingSameAsShipping?: boolean;
    billingAddress?: string;
    billingAddress2?: string;
    billingCity?: string;
    billingState?: string;
    billingZipCode?: string;
    apiProductId: number;
    promoCode?: string;
  },
  paymentToken: string,
): CreateStripeOrderPayload {
  const billingSame = session.billingSameAsShipping !== false;
  const promo = session.promoCode?.trim() || "";

  const payload: CreateStripeOrderPayload = {
    email: session.email,
    first_name: session.firstName,
    last_name: session.lastName,
    phone: session.phone.replace(/\D/g, ""),
    address: session.address!,
    city_name: session.city!,
    state_name: session.state!,
    zip_code: session.zipCode!,
    start_url: checkoutStartUrl(),
    payment_token: paymentToken,
    product_id: [session.apiProductId],
    billingSameAsShipping: billingSame ? "YES" : "NO",
    promo_codes: promo || null,
  };

  if (session.address2) {
    payload.address2 = session.address2;
  }

  if (!billingSame) {
    payload.billing_address = session.billingAddress || "";
    payload.billing_address2 = session.billingAddress2 || "";
    payload.billing_city_name = session.billingCity || "";
    payload.billing_state_name = session.billingState || "";
    payload.billing_zip_code = session.billingZipCode || "";
  }

  return payload;
}

/**
 * Creates an order via createOrder_stripe after a successful Stripe PaymentIntent.
 * Expected success response:
 * `{ status: 1, message: "Orders processed", success_orders: ["410889"], failed_orders: [] }`
 */
export async function createOrder(
  payload: CreateStripeOrderPayload,
): Promise<CreateOrderResult> {
  const res = await fetch(CREATE_ORDER_STRIPE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Order API failed (${res.status})`);
  }

  const json = (await res.json()) as CreateOrderResult | CreateOrderResult[];
  const result = Array.isArray(json) ? json[0] : json;
  if (!result) {
    throw new Error("Empty response from createOrder_stripe API");
  }

  if (result.status !== 1 || !orderIdFromCreateOrderResult(result)) {
    throw new Error(result.message || "Order API returned no success_orders");
  }

  const couponCode = payload.promo_codes?.trim();
  if (couponCode) {
    void notifyCouponOrderCreated({
      email: payload.email,
      coupon_code: couponCode,
    });
  }

  return result;
}

/** Non-blocking webhook when a coupon-backed order is created successfully. */
async function notifyCouponOrderCreated(params: {
  email: string;
  coupon_code: string;
}): Promise<void> {
  try {
    await fetch(COUPON_ORDER_WEBHOOK_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: String(COUPON_SITE_ID),
        orderStatus: "NO_ACTION",
        source: "checkout",
        email: params.email,
        coupon_code: params.coupon_code,
      }),
    });
  } catch (err) {
    console.error("[coupon order webhook]", err);
  }
}

export type CreatePaymentIntentPayload = {
  /** Amount in integer cents (Stripe convention). */
  amount: number;
  email: string;
  currency?: string;
  firstName: string;
  lastName: string;
  productName: string;
  sku: string;
  /** Panel product id (sent as string). */
  productId: string | number;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  coupon?: string;
  promo_codes?: string;
};

export type CreatePaymentIntentResult = {
  status?: number;
  clientSecret?: string;
  client_secret?: string;
  paymentIntentId?: string;
  id?: string;
  error?: string;
  message?: string;
  data?: {
    clientSecret?: string;
    client_secret?: string;
    paymentIntentId?: string;
    id?: string;
  };
};

function extractClientSecret(result: CreatePaymentIntentResult): string | null {
  return (
    result.clientSecret ||
    result.client_secret ||
    result.data?.clientSecret ||
    result.data?.client_secret ||
    null
  );
}

function extractPaymentIntentId(result: CreatePaymentIntentResult): string | null {
  return (
    result.paymentIntentId ||
    result.id ||
    result.data?.paymentIntentId ||
    result.data?.id ||
    null
  );
}

/**
 * Creates a Stripe PaymentIntent via the panel API (prod) or local Vite
 * middleware (dev). Returns the client secret for Stripe Elements.
 */
export async function createPaymentIntent(
  payload: CreatePaymentIntentPayload,
): Promise<{ clientSecret: string; paymentIntentId: string | null }> {
  const url = CREATE_PAYMENT_INTENT_API;

  const firstName = payload.firstName.trim();
  const lastName = payload.lastName.trim();
  const address = payload.address?.trim() || "";
  const city = payload.city?.trim() || "";
  const state = payload.state?.trim() || "";
  const zip = payload.zip?.trim() || "";
  const coupon = payload.coupon?.trim() || "";
  const promoCodes = payload.promo_codes?.trim() || coupon;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      email: payload.email,
      firstName,
      lastName,
      first_name: firstName,
      last_name: lastName,
      product_name: payload.productName,
      sku: payload.sku,
      amount: payload.amount,
      currency: payload.currency ?? "usd",
      productId: String(payload.productId),
      phone: payload.phone.replace(/\D/g, ""),
      address,
      city,
      city_name: city,
      state,
      state_name: state,
      zip,
      zip_code: zip,
      coupon,
      promo_codes: promoCodes,
    }),
  });

  const text = await res.text();
  let json: CreatePaymentIntentResult;
  try {
    json = JSON.parse(text) as CreatePaymentIntentResult;
  } catch {
    throw new Error(
      res.ok
        ? "Payment intent API returned a non-JSON response"
        : `Payment intent API failed (${res.status})`,
    );
  }

  if (!res.ok) {
    throw new Error(json.error || json.message || `Payment intent API failed (${res.status})`);
  }

  const clientSecret = extractClientSecret(json);
  if (!clientSecret) {
    throw new Error(json.error || json.message || "No client secret returned from payment intent API");
  }

  return {
    clientSecret,
    paymentIntentId: extractPaymentIntentId(json),
  };
}
