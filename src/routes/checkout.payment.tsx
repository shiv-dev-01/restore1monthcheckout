import semaVial from "@/assets/vial-semaglutide.png";
import tirzVial from "@/assets/vial-tirzepatide.png";
import {
  CheckoutFlowHeader,
  CheckoutLegalFooter,
  CheckoutStepProgress,
} from "@/components/checkout-v1-ui";
import { INCLUDED_LINES, PLANS, money, PRODUCTS, type ProductId } from "@/lib/checkout";
import {
  clearCheckoutSession,
  loadCheckoutSession,
  sessionAmountDue,
  type CheckoutSession,
} from "@/lib/checkout-session";
import {
  buildStripeOrderPayload,
  CREATE_ORDER_STRIPE_API,
  createOrder,
  createPaymentIntent,
  orderIdFromCreateOrderResult,
} from "@/lib/pricing-api";
import {
  dollarsToCents,
  getStripe,
  STRIPE_ELEMENTS_APPEARANCE,
  STRIPE_PUBLISHABLE_KEY,
} from "@/lib/stripe";
import { cn } from "@/lib/utils";
import { appendTrackingParams, parseTrackingSearch, trackingSearch, withTrackingSearch } from "@/lib/tracking-params";
import { fireCheckoutPageWebhook } from "@/lib/lead-webhook";
import { trackCheckout, trackEvent } from "@/lib/checkout-tracker";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/checkout/payment")({
  validateSearch: (search) => parseTrackingSearch(search),
  head: () => ({
    meta: [
      { title: "Payment — Restore Delivered" },
      {
        name: "description",
        content: "Enter payment details to complete your Restore GLP-1 order.",
      },
    ],
  }),
  component: PaymentPage,
});

const VIALS: Record<ProductId, string> = {
  semaglutide: semaVial,
  tirzepatide: tirzVial,
};

/** Stripe return_url — do NOT set orderId here (that blocked createOrder_stripe on redirect). */
function buildThankYouUrl(params: {
  email: string;
  amount: string;
  productName: string;
  firstName: string;
  lastName: string;
  phone: string;
  state?: string;
}) {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  const url = new URL(`${base}checkout/thank-you`, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  // Carry vid so the thank-you page tracker can resolve visitor_id
  const vid =
    new URLSearchParams(window.location.search).get("vid") ||
    sessionStorage.getItem("rd_vid");
  if (vid) url.searchParams.set("vid", vid);
  appendTrackingParams(url);
  return url.toString();
}

async function finalizeOrderWithStripe(
  paymentIntentId: string,
  productName: string,
) {
  const current = loadCheckoutSession();
  if (!current?.apiProductId) {
    throw new Error("Session expired. Please start again.");
  }

  const price = sessionAmountDue(current);
  const payload = buildStripeOrderPayload(current, paymentIntentId);
  console.log("[createOrder_stripe] posting", CREATE_ORDER_STRIPE_API, payload);
  const result = await createOrder(payload);
  console.log("[createOrder_stripe] response", result);

  const orderId = orderIdFromCreateOrderResult(result);
  if (result.status !== 1 || !orderId) {
    throw new Error(result.message || "Order creation failed after payment.");
  }

  clearCheckoutSession();
  return {
    email: current.email,
    orderId,
    amount: String(price),
    productName: current.apiProductName || productName,
    firstName: current.firstName,
    lastName: current.lastName,
    phone: current.phone,
    state: current.state,
  };
}

function PaymentPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  const stripePromise = useMemo(() => getStripe(), []);

  useEffect(() => {
    const stored = loadCheckoutSession();
    if (!stored?.email) {
      navigate({ to: "/", search: trackingSearch() });
      return;
    }
    if (!stored.address || !stored.city || !stored.state || !stored.zipCode) {
      navigate({ to: "/checkout/shipping", search: trackingSearch() });
      return;
    }
    setSession(stored);
  }, [navigate]);

  // Fire lead webhook once for Payment after checkout session is loaded
  useEffect(() => {
    if (!session?.email) return;
    fireCheckoutPageWebhook("payment", {
      first_name: session.firstName,
      last_name: session.lastName,
      email: session.email,
      phone: session.phone,
      state: session.state,
      address: session.address,
      city: session.city,
      zip: session.zipCode,
    });
    // Call #4 — payment screen opened
    trackEvent("payment_screen_opened", "checkout");
  }, [session]);

  useEffect(() => {
    if (!session?.email || !session.apiProductId) return;
    // BYPASS: $0 order — skip Stripe entirely
    if (sessionAmountDue(session) === 0) return;
    if (!STRIPE_PUBLISHABLE_KEY) {
      setInitError("Stripe publishable key is missing. Add VITE_STRIPE_PUBLISHABLE_KEY to .env.");
      return;
    }

    let cancelled = false;
    const amountCents = dollarsToCents(sessionAmountDue(session));

    (async () => {
      try {
        setInitError(null);
        const result = await createPaymentIntent({
          amount: amountCents,
          email: session.email,
          currency: "usd",
          firstName: session.firstName,
          lastName: session.lastName,
          productName: session.apiProductName || PRODUCTS[session.product].name,
          sku: session.apiProductSku || "",
          productId: session.apiProductId,
          phone: session.phone,
          address: session.address,
          city: session.city,
          state: session.state,
          zip: session.zipCode,
          coupon: session.promoCode || "",
          promo_codes: session.promoCode || "",
        });
        if (cancelled) return;
        setClientSecret(result.clientSecret);
        setPaymentIntentId(result.paymentIntentId);
      } catch (err) {
        if (cancelled) return;
        console.error("[createPaymentIntent]", err);
        setInitError(
          err instanceof Error
            ? err.message
            : "Unable to initialize secure payment. Please try again.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!session) {
    return (
      <div className="theme-v2-dark flex min-h-screen items-center justify-center bg-[#062B3D] font-sans text-sm text-foreground/70">
        Loading…
      </div>
    );
  }

  const product = PRODUCTS[session.product];
  const months = Number(session.planId);
  const originalPrice = session.originalPrice;
  const promoDiscount = session.promoDiscount ?? 0;
  const totalDue = sessionAmountDue(session);
  const perDay = totalDue / (months * 30);
  const plan = PLANS.find((p) => p.id === session.planId);
  const planLabel =
    session.planId === "1"
      ? "1-month supply delivered monthly"
      : `${session.planId}-month supply`;
  const planRowLabel = plan ? `${plan.name} plan` : `${session.planId}-Month Plan`;

  return (
    <div className="theme-v2-dark min-h-screen bg-[#062B3D] font-sans text-foreground antialiased">
      <CheckoutFlowHeader variant={session.variant} />
      <div className="mx-auto max-w-[560px] px-4 py-8 sm:px-6">
        <CheckoutStepProgress step="payment" />

        <div className="mt-6">
          <div className="rounded-lg bg-[#1B2A41] px-4 py-3 text-center font-sans text-[13px] text-white sm:px-5">
            Final step — your provider review begins as soon as you complete checkout.
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5">
          <div className="flex items-start gap-4">
            <img
              src={VIALS[session.product]}
              alt={`${product.name} vial`}
              className="h-24 w-16 shrink-0 object-contain"
            />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-[17px] font-bold text-foreground">
                    {product.name}
                  </div>
                  <div className="mt-0.5 text-[13px] text-foreground/60">{planLabel}</div>
                </div>
                <div className="shrink-0 text-[13px] font-semibold text-[#CBEAF8]">
                  ${perDay.toFixed(2)}/day
                </div>
              </div>
            </div>
          </div>

          <dl className="mt-5 space-y-2.5 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-foreground/60">{planRowLabel}</dt>
              <dd className="font-medium text-foreground">{money(originalPrice)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-foreground/60">Discount</dt>
              <dd className="font-bold uppercase tracking-wide text-[#93D3F0]">
                {promoDiscount > 0 ? `−${money(promoDiscount)}` : "INCLUDED"}
              </dd>
            </div>
            {INCLUDED_LINES.map((line) => (
              <div key={line.label} className="flex justify-between gap-3">
                <dt className="text-foreground/60">{line.label}</dt>
                <dd className="flex items-center gap-2">
                  <span className="text-foreground/35 line-through">{money(line.value)}</span>
                  <span className="font-bold uppercase tracking-wide text-[#93D3F0]">INCLUDED</span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
            <span className="text-[17px] font-bold text-foreground">Total Due</span>
            <span className="font-display text-[22px] font-bold text-[#CBEAF8]">
              {money(totalDue)}
            </span>
          </div>
        </div>

        <h1 className="mt-8 font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-foreground">
          Payment Details
        </h1>
        <p className="mt-1 text-[13px] text-foreground/60">Secure checkout • Powered by Stripe</p>

        {initError && (
          <div className="mt-5 rounded-xl border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {initError}
          </div>
        )}

        {/* BYPASS: 100% coupon — no Stripe needed */}
        {totalDue === 0 ? (
          <FreeCouponCheckoutForm session={session} productName={session.apiProductName || product.name} />
        ) : (
          <>
            {!initError && !clientSecret && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 px-4 py-8 text-center text-sm text-foreground/60">
                Preparing secure payment…
              </div>
            )}

            {clientSecret && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: STRIPE_ELEMENTS_APPEARANCE,
                }}
              >
                <StripeCheckoutForm
                  session={session}
                  totalDue={totalDue}
                  productName={session.apiProductName || product.name}
                  paymentIntentId={paymentIntentId}
                />
              </Elements>
            )}
          </>
        )}

        <CheckoutLegalFooter />
      </div>
    </div>
  );
}

/** Shown when a 100% coupon brings totalDue to $0 — skips Stripe entirely. */
function FreeCouponCheckoutForm({
  session,
  productName,
}: {
  session: CheckoutSession;
  productName: string;
}) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleFreeOrder() {
    setSubmitting(true);
    setFormError(null);
    try {
      const current = loadCheckoutSession();
      if (!current?.apiProductId) throw new Error("Session expired. Please start again.");

      const payload = buildStripeOrderPayload(current, "free_coupon_100");
      const result = await createOrder(payload);
      const orderId = orderIdFromCreateOrderResult(result);
      if (result.status !== 1 || !orderId) {
        throw new Error(result.message || "Order creation failed.");
      }

      paidRef.current = true;
      trackCheckout({
        status: "paid",
        amount: 0,
        currency: "USD",
        order_ref: orderId,
        name: `${current.firstName} ${current.lastName}`.trim(),
        email: current.email,
        phone: current.phone,
        payload: { planId: current.planId },
      });

      clearCheckoutSession();
      navigate({
        to: "/checkout/thank-you",
        search: withTrackingSearch({
          email: current.email,
          orderId,
          amount: "0",
          productName: current.apiProductName || productName,
          firstName: current.firstName,
          lastName: current.lastName,
          phone: current.phone,
          state: current.state,
        }),
      });
    } catch (err) {
      console.error("[FreeCouponCheckoutForm]", err);
      setFormError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // fire abandoned on unload (unpaid)
  const paidRef = { current: false };
  useEffect(() => {
    function onBeforeUnload() {
      if (paidRef.current) return;
      trackCheckout({
        status: "abandoned",
        name: `${session.firstName} ${session.lastName}`.trim(),
        email: session.email,
        phone: session.phone,
        payload: { planId: session.planId },
      });
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-5">
      <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-5 text-center text-sm text-foreground/70">
        Your coupon covers the full amount — no payment details required.
      </div>

      {formError && (
        <div className="mt-4 rounded-xl border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {formError}
        </div>
      )}

      <div className="mt-8">
        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleFreeOrder()}
          className={cn(
            "mx-auto block w-full rounded-full bg-[#CBEAF8] px-6 py-3.5 text-center text-[15px] font-bold text-[#062B3D] shadow-[0_8px_24px_-10px_rgba(203,234,248,0.45)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {submitting ? "Processing…" : "Complete Secure Checkout — $0.00"}
        </button>
      </div>

      <div className="mt-4 flex flex-col items-center gap-2 text-center">
        <p className="max-w-md text-[12px] leading-relaxed text-foreground/55 underline underline-offset-2">
          You will be refunded if a licensed provider does not approve your prescription.
        </p>
        <p className="max-w-md text-[12px] leading-relaxed text-foreground/45">
          By completing checkout, you agree to our{" "}
          <Link to="/" search={trackingSearch()} className="underline underline-offset-2 hover:text-[#93D3F0]">
            Terms
          </Link>{" "}
          and authorize recurring payments according to your selected plan.
        </p>
      </div>
    </div>
  );
}

function StripeCheckoutForm({
  session,
  totalDue,
  productName,
  paymentIntentId,
}: {
  session: CheckoutSession;
  totalDue: number;
  productName: string;
  paymentIntentId: string | null;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Track whether payment is confirmed so beforeunload fires "abandoned" only when unpaid
  const paidRef = { current: false };

  // Call #6 — abandoned (user leaves before paying)
  useEffect(() => {
    function onBeforeUnload() {
      if (paidRef.current) return;
      trackCheckout({
        status: "abandoned",
        name: `${session.firstName} ${session.lastName}`.trim(),
        email: session.email,
        phone: session.phone,
        payload: { planId: session.planId },
      });
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    if (!stripe || !elements) {
      setFormError("Stripe is still loading. Please wait a moment.");
      return;
    }

    const current = loadCheckoutSession();
    if (!current?.apiProductId) {
      setFormError("Session expired. Please start again.");
      navigate({ to: "/", search: trackingSearch() });
      return;
    }

    const price = sessionAmountDue(current);
    const billingSame = current.billingSameAsShipping !== false;
    const returnUrl = buildThankYouUrl({
      email: current.email,
      amount: String(price),
      productName: current.apiProductName || productName,
      firstName: current.firstName,
      lastName: current.lastName,
      phone: current.phone,
      state: current.state,
    });

    setSubmitting(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
          receipt_email: current.email,
          payment_method_data: {
            billing_details: {
              name: `${current.firstName} ${current.lastName}`.trim(),
              email: current.email,
              phone: current.phone,
              address: {
                line1: billingSame ? current.address : current.billingAddress,
                line2: billingSame
                  ? current.address2 || undefined
                  : current.billingAddress2 || undefined,
                city: billingSame ? current.city : current.billingCity,
                state: billingSame ? current.state : current.billingState,
                postal_code: billingSame ? current.zipCode : current.billingZipCode,
                country: "US",
              },
            },
          },
        },
        redirect: "if_required",
      });

      if (error) {
        throw new Error(error.message || "Payment failed. Please try again.");
      }

      if (
        paymentIntent &&
        (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")
      ) {
        const thankYou = await finalizeOrderWithStripe(paymentIntent.id, productName);
        paidRef.current = true;
        // Call #5 — paid
        trackCheckout({
          status: "paid",
          amount: thankYou.amount ? Number(thankYou.amount) : totalDue,
          currency: "USD",
          order_ref: thankYou.orderId,
          name: `${thankYou.firstName} ${thankYou.lastName}`.trim(),
          email: thankYou.email,
          phone: thankYou.phone,
          payload: { planId: current.planId },
        });
        navigate({
          to: "/checkout/thank-you",
          search: withTrackingSearch(thankYou),
        });
        return;
      }

      throw new Error("Payment was not completed. Please try again.");
    } catch (err) {
      console.error("Stripe payment error:", err);
      // Call #6 — failed
      const current2 = loadCheckoutSession();
      trackCheckout({
        status: "failed",
        name: `${session.firstName} ${session.lastName}`.trim(),
        email: session.email,
        phone: session.phone,
        payload: { planId: current2?.planId ?? session.planId },
      });
      setFormError(
        err instanceof Error
          ? err.message
          : "There was an error processing your payment. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-5" onSubmit={onSubmit}>
      <div className="space-y-4 rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5">
        <PaymentElement
          options={{
            layout: "tabs",
            defaultValues: {
              billingDetails: {
                name: `${session.firstName} ${session.lastName}`.trim(),
                email: session.email,
                phone: session.phone,
              },
            },
          }}
        />
      </div>

      {formError && (
        <div className="mt-4 rounded-xl border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {formError}
        </div>
      )}

      <div className="mt-8">
        <button
          type="submit"
          disabled={!stripe || !elements || submitting}
          className={cn(
            "mx-auto block w-full rounded-full bg-[#CBEAF8] px-6 py-3.5 text-center text-[15px] font-bold text-[#062B3D] shadow-[0_8px_24px_-10px_rgba(203,234,248,0.45)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {submitting ? "Processing…" : `Pay ${money(totalDue)} — Complete Secure Checkout`}
        </button>
      </div>

      <div className="mt-4 flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-1.5 text-[12px] text-foreground/60">
          <Lock className="h-3.5 w-3.5" />
          Secured by Stripe · 256-bit SSL encryption
        </div>
        <p className="max-w-md text-[12px] leading-relaxed text-foreground/55 underline underline-offset-2">
          You will be refunded if a licensed provider does not approve your prescription.
        </p>
        <p className="max-w-md text-[12px] leading-relaxed text-foreground/45">
          By completing checkout, you agree to our{" "}
          <Link
            to="/"
            search={trackingSearch()}
            className="underline underline-offset-2 hover:text-[#93D3F0]"
          >
            Terms
          </Link>{" "}
          and authorize recurring payments according to your selected plan.
        </p>
      </div>
    </form>
  );
}
