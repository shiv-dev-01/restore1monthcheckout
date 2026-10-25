import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  FALLBACK_PLAN_TOTALS,
  HARDCODED_ONE_MONTH_PRODUCTS,
  getPricingBundle,
  type PlanId,
  type PlanTotals,
  type ProductCatalog,
  type ProductId,
} from "@/lib/pricing-api";

export type { ProductId, PlanId };

export type Plan = {
  id: PlanId;
  name: string;
  months: number;
  blurb: string;
  badge?: string;
};

export const PLANS: Plan[] = [
  {
    id: "12",
    name: "12-Month Transformation",
    months: 12,
    blurb: "Maximum savings",
    badge: "Best Price",
  },
  {
    id: "6",
    name: "6-Month Optimization",
    months: 6,
    blurb: "Best long-term results",
  },
  {
    id: "3",
    name: "3-Month GLP Momentum",
    months: 3,
    blurb: "Convenient automatic deliveries",
  },
  {
    id: "1",
    name: "1-Month GLP Starter",
    months: 1,
    blurb: "Low commitment — cancel anytime",
  },
];

/** Per-unit retail values used for Restore Studio stack math. */
export const STUDIO_UNIT_VALUES = {
  inBody: 39,
  lipoB12: 60,
  infrared: 39,
  redLight: 39,
  glp1Iv: 263,
} as const;

export type StackAddOnItem = {
  label: string;
  value: number;
};

export type StackAddOns = {
  title: string;
  totalValue: number;
  items: StackAddOnItem[];
};

/** Credits applied per plan stack (shown below Included at no extra cost). */
export const STACK_ADD_ONS: Record<PlanId, StackAddOns> = {
  "1": {
    title: "1-Month GLP Starter Stack Add Ons",
    totalValue: 177,
    items: [
      { label: "1 InBody Scan", value: STUDIO_UNIT_VALUES.inBody },
      { label: "1 Lipo-B12 IM", value: STUDIO_UNIT_VALUES.lipoB12 },
      { label: "1 Infrared Sauna Session", value: STUDIO_UNIT_VALUES.infrared },
      { label: "1 Red Light Therapy Session", value: STUDIO_UNIT_VALUES.redLight },
    ],
  },
  "3": {
    title: "3-Month GLP Momentum Stack Add Ons",
    totalValue: 333,
    items: [
      { label: "3 InBody Scans (Monthly)", value: 3 * STUDIO_UNIT_VALUES.inBody },
      { label: "1 Lipo-B12 IM", value: STUDIO_UNIT_VALUES.lipoB12 },
      { label: "2 Infrared Sauna Sessions", value: 2 * STUDIO_UNIT_VALUES.infrared },
      { label: "2 Red Light Therapy Sessions", value: 2 * STUDIO_UNIT_VALUES.redLight },
    ],
  },
  "6": {
    title: "6-Month Optimization Stack Add Ons",
    totalValue: 713,
    items: [
      { label: "6 InBody Scans (Monthly)", value: 6 * STUDIO_UNIT_VALUES.inBody },
      { label: "1 Lipo-B12 IM", value: STUDIO_UNIT_VALUES.lipoB12 },
      { label: "2 Infrared Sauna Sessions", value: 2 * STUDIO_UNIT_VALUES.infrared },
      { label: "2 Red Light Therapy Sessions", value: 2 * STUDIO_UNIT_VALUES.redLight },
      { label: "1 GLP-1 Support IV", value: STUDIO_UNIT_VALUES.glp1Iv },
    ],
  },
  "12": {
    title: "12-Month Transformation Stack Add Ons",
    totalValue: 1210,
    items: [
      { label: "12 InBody Scans (Monthly)", value: 12 * STUDIO_UNIT_VALUES.inBody },
      { label: "1 Lipo-B12 IM", value: STUDIO_UNIT_VALUES.lipoB12 },
      { label: "2 Infrared Sauna Sessions", value: 2 * STUDIO_UNIT_VALUES.infrared },
      { label: "2 Red Light Therapy Sessions", value: 2 * STUDIO_UNIT_VALUES.redLight },
      { label: "2 GLP-1 Support IVs", value: 2 * STUDIO_UNIT_VALUES.glp1Iv },
    ],
  },
};

/** @deprecated Prefer planTotals from useCheckout — kept as static fallback. */
export const PLAN_TOTALS = FALLBACK_PLAN_TOTALS;

const monthlyRate = (totals: PlanTotals, product: ProductId, id: PlanId) =>
  totals[product][id] / PLANS.find((p) => p.id === id)!.months;

function buildPricing(totals: PlanTotals): Record<ProductId, Record<PlanId, number>> {
  return {
    semaglutide: {
      "12": monthlyRate(totals, "semaglutide", "12"),
      "6": monthlyRate(totals, "semaglutide", "6"),
      "3": monthlyRate(totals, "semaglutide", "3"),
      "1": monthlyRate(totals, "semaglutide", "1"),
    },
    tirzepatide: {
      "12": monthlyRate(totals, "tirzepatide", "12"),
      "6": monthlyRate(totals, "tirzepatide", "6"),
      "3": monthlyRate(totals, "tirzepatide", "3"),
      "1": monthlyRate(totals, "tirzepatide", "1"),
    },
  };
}

/** @deprecated Prefer pricing from useCheckout — derived from static fallback totals. */
export const PRICING = buildPricing(FALLBACK_PLAN_TOTALS);

export const PRODUCTS: Record<
  ProductId,
  { id: ProductId; name: string; tier: string; bullets: string[] }
> = {
  semaglutide: {
    id: "semaglutide",
    name: "Semaglutide",
    tier: "Single-action GLP-1",
    bullets: ["Cheaper than lunch", "1 simple injection weekly", "#1 choice among members"],
  },
  tirzepatide: {
    id: "tirzepatide",
    name: "Tirzepatide",
    tier: "Dual-action GLP-1 / GIP",
    bullets: ["Cheaper than lunch", "1 simple injection weekly", "Dual-action formulation"],
  },
};

// Line items that are bundled into every plan at no extra charge.
export const INCLUDED_LINES = [
  { label: "Online Clinician Visit", value: 49 },
  { label: "Shipping 1-5 days from approval", value: 19.99 },
];

export const INCLUDED_BENEFITS = [
  // { label: "Private & Encrypted", detail: "Your info stays protected", value: 129.99 },
  { label: "Unlimited", detail: "Chats with clinicians", value: 69.99 },
  // { label: "100% U.S.", detail: "Based care support agents", value: 49.99 },
  { label: "On-Time Refills", detail: "Guaranteed", value: 69.99 },
];

export const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

const EMPTY_PRODUCTS: ProductCatalog = HARDCODED_ONE_MONTH_PRODUCTS;

export function useCheckout(opts?: { product?: ProductId; planId?: PlanId }) {
  const [product, setProduct] = useState<ProductId>(opts?.product ?? "semaglutide");
  const [planId, setPlanId] = useState<PlanId>("1");

  const pricingQuery = useQuery({
    queryKey: ["pricing-bundle"],
    queryFn: () => getPricingBundle(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const planTotals = pricingQuery.data?.planTotals ?? FALLBACK_PLAN_TOTALS;
  const apiProducts = pricingQuery.data?.products ?? EMPTY_PRODUCTS;
  const pricing = useMemo(() => buildPricing(planTotals), [planTotals]);
  const selectedApiProduct = apiProducts[product][planId];

  const values = useMemo(() => {
    const plan = PLANS.find((p) => p.id === planId)!;
    const monthly = pricing[product][planId];
    const reference = pricing[product]["1"];
    const total = planTotals[product][planId];
    const savings = reference * plan.months - total;
    const perDay = total / (plan.months * 30);
    const bundledValue =
      INCLUDED_LINES.reduce((s, l) => s + l.value, 0) +
      INCLUDED_BENEFITS.reduce((s, l) => s + l.value, 0);

    return { plan, monthly, reference, total, savings, perDay, bundledValue };
  }, [product, planId, pricing, planTotals]);

  const savingsFor = (id: PlanId) => {
    const plan = PLANS.find((p) => p.id === id)!;
    return pricing[product]["1"] * plan.months - planTotals[product][id];
  };

  return {
    product,
    setProduct,
    planId,
    setPlanId,
    savingsFor,
    pricing,
    planTotals,
    apiProducts,
    selectedApiProduct,
    pricesLoading: pricingQuery.isLoading,
    pricesError: pricingQuery.isError,
    ...values,
  };
}
