import { z } from "zod";
import type { PlanId, ProductId } from "@/lib/pricing-api";
import type { TrackingParams } from "@/lib/tracking-params";

/** TanStack Router JSON-parses query values, so `planId=12` becomes a number. */
const searchString = z
  .union([z.string(), z.number(), z.boolean()])
  .optional()
  .transform((value) => (value === undefined ? undefined : String(value)));

const PRODUCT_IDS: readonly ProductId[] = ["semaglutide", "tirzepatide"];
const PLAN_IDS: readonly PlanId[] = ["12", "6", "3", "1"];

function asProduct(value: string | undefined): ProductId | undefined {
  const normalized = value?.trim().toLowerCase();
  return PRODUCT_IDS.includes(normalized as ProductId)
    ? (normalized as ProductId)
    : undefined;
}

function asPlanId(value: string | undefined): PlanId | undefined {
  const normalized = value?.trim();
  return PLAN_IDS.includes(normalized as PlanId) ? (normalized as PlanId) : undefined;
}

/** Optional prefill + tracking keys. All fields optional so `/` links don't require `search`. */
export type CheckoutPrefill = {
  fname?: string;
  lname?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  product?: ProductId;
  planId?: PlanId;
} & TrackingParams &
  Record<string, unknown>;

/**
 * Query params used to deep-link into WL checkout, e.g.
 * /wl_checkout/?fname=Jane&lname=Doe&email=jane%40example.com&phone=5555555555
 *   &address=123%20Main%20St&city=Austin&state=TX&zip=78704&product=tirzepatide&planId=12
 *
 * `.passthrough()` + spreading unknown keys keeps UTM / click-id params in the URL.
 * `src/lib/tracking-params.ts` persists the same keys through shipping → payment → thank-you.
 */
export const checkoutPrefillSearchSchema = z
  .object({
    fname: searchString,
    lname: searchString,
    email: searchString,
    phone: searchString,
    address: searchString,
    city: searchString,
    state: searchString,
    zip: searchString,
    product: searchString,
    planId: searchString,
  })
  .passthrough()
  .transform((raw): CheckoutPrefill => {
    const {
      fname,
      lname,
      email,
      phone,
      address,
      city,
      state,
      zip,
      product,
      planId,
      ...rest
    } = raw;
    return {
      ...rest,
      fname: fname?.trim() || undefined,
      lname: lname?.trim() || undefined,
      email: email?.trim() || undefined,
      phone: phone?.trim() || undefined,
      address: address?.trim() || undefined,
      city: city?.trim() || undefined,
      state: state?.trim().toUpperCase() || undefined,
      zip: zip?.trim() || undefined,
      product: asProduct(product),
      planId: asPlanId(planId),
    };
  });
