import type { CheckoutVariant } from "@/lib/checkout-session";
import { saveCheckoutSession, validateContact } from "@/lib/checkout-session";
import { saveLeadAnswers } from "@/lib/lead-webhook";
import type { PlanId, PricingApiProduct, ProductId } from "@/lib/pricing-api";

export type ContinueToShippingInput = {
  variant: CheckoutVariant;
  product: ProductId;
  planId: PlanId;
  total: number;
  selectedApiProduct?: PricingApiProduct;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  /** Optional address prefill from deep-link query params. */
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  promoCode?: string;
  promoDiscount?: number;
};

export async function continueToShipping(input: ContinueToShippingInput): Promise<
  | { ok: true }
  | { ok: false; errors: Record<string, string> }
> {
  const errors = validateContact({
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    email: input.email,
  });

  if (!input.selectedApiProduct?.product_id) {
    errors.product = "Product pricing is still loading. Please try again in a moment.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const apiProduct = input.selectedApiProduct!;
  const originalPrice = Number.parseFloat(apiProduct.price) || input.total;
  const promoDiscount =
    input.promoCode && (input.promoDiscount ?? 0) > 0
      ? Math.round((input.promoDiscount ?? 0) * 100) / 100
      : 0;
  const chargedAmount = Math.max(0, Math.round((originalPrice - promoDiscount) * 100) / 100);

  // Persist contact into lead answers for onboarding handoff.
  saveLeadAnswers({
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    plan: input.planId,
    med_interest: input.product,
  });

  saveCheckoutSession({
    variant: input.variant,
    product: input.product,
    planId: input.planId,
    apiProductId: apiProduct.product_id,
    apiProductName: apiProduct.product_name,
    apiProductSku: apiProduct.sku,
    originalPrice,
    chargedAmount,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    ...(input.address?.trim() ? { address: input.address.trim() } : {}),
    ...(input.city?.trim() ? { city: input.city.trim() } : {}),
    ...(input.state?.trim() ? { state: input.state.trim().toUpperCase() } : {}),
    ...(input.zipCode?.trim() ? { zipCode: input.zipCode.trim() } : {}),
    billingSameAsShipping: true,
    reservedAt: Date.now(),
    ...(input.promoCode && promoDiscount > 0
      ? { promoCode: input.promoCode, promoDiscount }
      : {}),
  });

  return { ok: true };
}
