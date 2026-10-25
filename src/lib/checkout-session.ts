import type { PlanId, ProductId } from "@/lib/pricing-api";

const STORAGE_KEY = "restore_checkout_flow_v1";

export type CheckoutVariant = "v1" | "v2" | "v3" | "wl";

export type CheckoutSession = {
  variant: CheckoutVariant;
  product: ProductId;
  planId: PlanId;
  apiProductId: number;
  apiProductName: string;
  apiProductSku?: string;
  originalPrice: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
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
  orderId?: string | number;
  chargedAmount?: number;
  /** Applied promo code (uppercase). */
  promoCode?: string;
  /** Dollar discount from check_coupons. */
  promoDiscount?: number;
  /** Epoch ms when the reservation countdown started. */
  reservedAt?: number;
};

export const RESERVATION_SECONDS = 10 * 60;

export function getReservationSecondsLeft(session: CheckoutSession | null): number {
  if (!session?.reservedAt) return RESERVATION_SECONDS;
  const elapsed = Math.floor((Date.now() - session.reservedAt) / 1000);
  return Math.max(0, RESERVATION_SECONDS - elapsed);
}

export function loadCheckoutSession(): CheckoutSession | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CheckoutSession;
  } catch {
    return null;
  }
}

export function saveCheckoutSession(session: CheckoutSession) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function updateCheckoutSession(patch: Partial<CheckoutSession>) {
  const current = loadCheckoutSession();
  if (!current) return null;
  const next = { ...current, ...patch };
  saveCheckoutSession(next);
  return next;
}

export function clearCheckoutSession() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

/** Final amount charged after coupon (falls back to original − discount). */
export function sessionAmountDue(session: CheckoutSession): number {
  if (typeof session.chargedAmount === "number" && Number.isFinite(session.chargedAmount)) {
    return Math.max(0, Math.round(session.chargedAmount * 100) / 100);
  }
  return Math.max(
    0,
    Math.round((session.originalPrice - (session.promoDiscount ?? 0)) * 100) / 100,
  );
}

export function validateContact(fields: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!fields.firstName.trim()) errors.firstName = "First name is required";
  if (!fields.lastName.trim()) errors.lastName = "Last name is required";
  const digits = fields.phone.replace(/\D/g, "");
  if (!fields.phone.trim()) errors.phone = "Phone number is required";
  else if (digits.length !== 10) errors.phone = "Phone number must be exactly 10 digits";
  if (!fields.email.trim()) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = "Please enter a valid email address";
  }
  return errors;
}

export function validateShipping(fields: {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  billingSameAsShipping: boolean;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingZipCode?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!fields.address.trim()) errors.address = "Street address is required";
  if (!fields.city.trim()) errors.city = "City is required";
  if (!fields.state.trim()) errors.state = "State is required";
  if (!fields.zipCode.trim()) errors.zipCode = "ZIP code is required";
  else if (fields.zipCode.trim().length !== 5) errors.zipCode = "ZIP code must be 5 digits";

  if (!fields.billingSameAsShipping) {
    if (!fields.billingAddress?.trim()) errors.billingAddress = "Billing street address is required";
    if (!fields.billingCity?.trim()) errors.billingCity = "Billing city is required";
    if (!fields.billingState?.trim()) errors.billingState = "Billing state is required";
    if (!fields.billingZipCode?.trim()) errors.billingZipCode = "Billing ZIP code is required";
    else if (fields.billingZipCode.trim().length !== 5) {
      errors.billingZipCode = "Billing ZIP code must be 5 digits";
    }
  }
  return errors;
}

export function validateCard(fields: {
  cardNumber: string;
  expiry: string;
  cvc: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const digits = fields.cardNumber.replace(/\s/g, "");
  if (!fields.cardNumber.trim()) errors.cardNumber = "Card number is required";
  else if (digits.length < 13) errors.cardNumber = "Please enter a valid card number";
  if (!fields.expiry.trim()) errors.expiry = "Expiry date is required";
  else if (fields.expiry.trim().length < 5) {
    errors.expiry = "Please enter a valid expiry date (MM/YY)";
  }
  if (!fields.cvc.trim()) errors.cvc = "CVV is required";
  else if (fields.cvc.trim().length < 3) errors.cvc = "CVV must be at least 3 digits";
  return errors;
}

export function detectCardType(cardNumber: string): string {
  const digits = cardNumber.replace(/\s/g, "");
  if (digits.startsWith("4")) return "visa";
  if (digits.startsWith("5")) return "mastercard";
  if (digits.startsWith("3")) return "amex";
  return "visa";
}

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;
