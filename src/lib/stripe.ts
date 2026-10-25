import { loadStripe, type Stripe } from "@stripe/stripe-js";

export const STRIPE_PUBLISHABLE_KEY =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() || "";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!STRIPE_PUBLISHABLE_KEY) {
    return Promise.resolve(null);
  }
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
}

/** Dollars → Stripe/API integer cents. */
export function dollarsToCents(amount: number): number {
  return Math.max(0, Math.round(amount * 100));
}

/** Stripe Elements themed to match Restore dark funnel checkout. */
export const STRIPE_ELEMENTS_APPEARANCE = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#93D3F0",
    colorBackground: "#0A1620",
    colorText: "#F0F7FA",
    colorDanger: "#fca5a5",
    fontFamily: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif',
    borderRadius: "12px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1px solid rgba(240, 247, 250, 0.15)",
      backgroundColor: "rgba(0, 0, 0, 0.2)",
      boxShadow: "none",
    },
    ".Input:focus": {
      border: "1px solid #93D3F0",
      boxShadow: "0 0 0 1px #93D3F0",
    },
    ".Label": {
      fontWeight: "600",
      color: "#D2E1E9",
    },
    ".Tab": {
      border: "1px solid rgba(240, 247, 250, 0.12)",
      backgroundColor: "rgba(0, 0, 0, 0.15)",
      color: "#F0F7FA",
    },
    ".Tab:hover": {
      color: "#FFFFFF",
    },
    ".Tab--selected": {
      border: "1px solid #93D3F0",
      backgroundColor: "rgba(147, 211, 240, 0.12)",
      color: "#FFFFFF",
    },
    ".TabLabel": {
      color: "#F0F7FA",
    },
    ".TabLabel--selected": {
      color: "#FFFFFF",
    },
    ".TabIcon": {
      fill: "#F0F7FA",
    },
    ".TabIcon--selected": {
      fill: "#FFFFFF",
    },
  },
};
