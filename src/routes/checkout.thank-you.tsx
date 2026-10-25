import logo from "@/assets/restore-logo.svg";
import {
  clearCheckoutSession,
  loadCheckoutSession,
  sessionAmountDue,
  type CheckoutSession,
} from "@/lib/checkout-session";
import {
  buildStripeOrderPayload,
  createOrder,
  orderIdFromCreateOrderResult,
} from "@/lib/pricing-api";
import {
  captureTrackingParams,
  trackingSearchSchema,
  withTrackingSearch,
  trackingSearch,
} from "@/lib/tracking-params";
import { fireCheckoutPageWebhook } from "@/lib/lead-webhook";
import { trackCheckout } from "@/lib/checkout-tracker";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

const MEMBER_PORTAL_URL = "https://member.restoredelivered.com/";

/** Dedupes createOrder_stripe across React StrictMode remounts / double effects. */
const finalizeInflight = new Map<string, Promise<string>>();

/**
 * TanStack Router JSON-parses query values, so `amount=1188` becomes a number.
 * Stripe return URLs use bare numbers — coerce everything to string.
 */
const searchString = z
  .union([z.string(), z.number(), z.boolean()])
  .optional()
  .transform((value) => (value === undefined ? undefined : String(value)));

const thankYouSearchSchema = z
  .object({
    email: searchString,
    orderId: searchString,
    amount: searchString,
    productName: searchString,
    firstName: searchString,
    lastName: searchString,
    phone: searchString,
    state: searchString,
    /** Stripe redirect query params (Apple Pay / Amazon Pay / 3DS). */
    payment_intent: searchString,
    payment_intent_client_secret: searchString,
    redirect_status: searchString,
  })
  .merge(trackingSearchSchema)
  .passthrough();

export const Route = createFileRoute("/checkout/thank-you")({
  validateSearch: (search) => thankYouSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Thank you — Restore Delivered" },
      {
        name: "description",
        content: "Your Restore GLP-1 order has been submitted for provider review.",
      },
    ],
  }),
  component: ThankYouPage,
});

/** Real CRM order ids are numeric; Stripe PaymentIntent ids start with `pi_`. */
function isRealOrderId(orderId: string | undefined): boolean {
  if (!orderId?.trim()) return false;
  if (orderId.startsWith("pi_") || orderId === "pending") return false;
  return true;
}

function finalizeCacheKey(paymentIntentId: string) {
  return `restore_stripe_order_${paymentIntentId}`;
}

async function createOrderForPaymentIntent(
  paymentIntentId: string,
  session: CheckoutSession,
): Promise<string> {
  const cached = sessionStorage.getItem(finalizeCacheKey(paymentIntentId));
  if (cached) return cached;

  const existing = finalizeInflight.get(paymentIntentId);
  if (existing) return existing;

  const promise = (async () => {
    const payload = buildStripeOrderPayload(session, paymentIntentId);
    console.log("[thank-you createOrder_stripe] posting", payload);
    const result = await createOrder(payload);
    console.log("[thank-you createOrder_stripe] response", result);
    const orderId = orderIdFromCreateOrderResult(result);
    if (result.status !== 1 || !orderId) {
      throw new Error(result.message || "Order creation failed after payment.");
    }
    sessionStorage.setItem(finalizeCacheKey(paymentIntentId), orderId);
    clearCheckoutSession();
    return orderId;
  })().finally(() => {
    finalizeInflight.delete(paymentIntentId);
  });

  finalizeInflight.set(paymentIntentId, promise);
  return promise;
}

function ThankYouPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  useEffect(() => {
    captureTrackingParams(search);
  }, [search]);

  // Fire lead webhook once for Thank You page
  useEffect(() => {
    fireCheckoutPageWebhook("thank-you", {
      first_name: search.firstName,
      last_name: search.lastName,
      email: search.email,
      phone: search.phone,
      state: search.state,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Call #5 — paid (fires when we land on the settled thank-you with a real order id,
  // which covers the Stripe redirect path; the direct-navigate path already fired in payment.tsx)
  useEffect(() => {
    if (!isRealOrderId(search.orderId)) return;
    // Only fire for the Stripe redirect path (payment.tsx fires for the SPA path)
    if (!search.payment_intent) return;
    trackCheckout({
      status: "paid",
      amount: search.amount ? Number(search.amount) : undefined,
      currency: "USD",
      order_ref: search.orderId,
      name: `${search.firstName ?? ""} ${search.lastName ?? ""}`.trim() || undefined,
      email: search.email,
      phone: search.phone,
      payload: { planId: undefined },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.orderId]);

  useEffect(() => {
    const stripePi = search.payment_intent?.trim();
    const redirectStatus = search.redirect_status?.trim();

    if (
      redirectStatus === "failed" ||
      redirectStatus === "canceled" ||
      redirectStatus === "requires_payment_method"
    ) {
      setFinalizeError(
        "Payment was not completed. No charge should have gone through — please try again.",
      );
      return;
    }

    if (isRealOrderId(search.orderId) && !stripePi) return;

    const redirectOk =
      redirectStatus === "succeeded" || redirectStatus === "processing";
    if (!stripePi || !redirectOk) return;
    if (isRealOrderId(search.orderId)) return;

    const cachedOrderId = sessionStorage.getItem(finalizeCacheKey(stripePi));
    if (cachedOrderId) {
      navigate({
        to: "/checkout/thank-you",
        search: withTrackingSearch({
          email: search.email,
          orderId: cachedOrderId,
          amount: search.amount,
          productName: search.productName,
          firstName: search.firstName,
          lastName: search.lastName,
          phone: search.phone,
          state: search.state,
        }),
        replace: true,
      });
      return;
    }

    const session = loadCheckoutSession();
    if (!session?.apiProductId) {
      setFinalizeError(
        `Payment succeeded, but your checkout session expired before the order could be saved. Contact support with payment reference ${stripePi}.`,
      );
      return;
    }

    let cancelled = false;
    setFinalizing(true);
    setFinalizeError(null);

    const price = sessionAmountDue(session);

    createOrderForPaymentIntent(stripePi, session)
      .then((orderId) => {
        if (cancelled) return;
        navigate({
          to: "/checkout/thank-you",
          search: withTrackingSearch({
            email: session.email,
            orderId,
            amount: String(price),
            productName: session.apiProductName || search.productName,
            firstName: session.firstName,
            lastName: session.lastName,
            phone: session.phone,
            state: session.state,
          }),
          replace: true,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("[thank-you createOrder]", err);
        setFinalizeError(
          err instanceof Error
            ? err.message
            : "Payment may have succeeded, but we could not create your order. Please contact support.",
        );
      })
      .finally(() => {
        if (!cancelled) setFinalizing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    navigate,
    search.amount,
    search.email,
    search.firstName,
    search.lastName,
    search.orderId,
    search.payment_intent,
    search.phone,
    search.productName,
    search.redirect_status,
    search.state,
  ]);

  const awaitingStripeOrder =
    !!search.payment_intent &&
    (search.redirect_status === "succeeded" || search.redirect_status === "processing") &&
    !isRealOrderId(search.orderId) &&
    !finalizeError;

  if (finalizing || awaitingStripeOrder) {
    return (
      <div className="theme-v2-dark flex min-h-screen items-center justify-center bg-[#062B3D] px-4 py-10 text-sm text-foreground/70">
        Finalizing your order…
      </div>
    );
  }

  if (finalizeError) {
    return (
      <div className="theme-v2-dark flex min-h-screen items-center justify-center bg-[#062B3D] px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0A1620] px-6 py-8 text-center">
          <h1 className="font-display text-lg font-bold text-foreground">Payment issue</h1>
          <p className="mt-3 text-sm text-red-200">{finalizeError}</p>
          {search.payment_intent && (
            <p className="mt-2 break-all text-xs text-foreground/45">
              Reference: {search.payment_intent}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Link
              to="/checkout/payment"
              search={trackingSearch()}
              className="inline-flex items-center justify-center rounded-full bg-[#CBEAF8] px-5 py-3 text-sm font-bold text-[#062B3D] hover:brightness-105"
            >
              Try payment again
            </Link>
            <Link
              to="/"
              search={trackingSearch()}
              className="text-sm font-medium text-[#93D3F0] hover:underline"
            >
              Back to checkout
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-v2-dark flex min-h-screen items-center justify-center bg-[#062B3D] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0A1620] px-6 py-8 sm:px-8">
        <div className="flex justify-center">
          <img
            src={logo}
            alt="Restore Hyper Wellness"
            className="h-10 w-auto brightness-0 invert"
          />
        </div>

        <div className="mt-8 flex items-center justify-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#93D3F0]">
            <Check className="h-4 w-4 text-[#062B3D]" strokeWidth={3} />
          </span>
          <h1 className="font-display text-xl font-bold leading-snug text-foreground">
            Payment received.
            <br />
            Thanks for your order!
          </h1>
        </div>

        <p className="mt-4 text-center text-base font-semibold text-foreground">
          You&apos;re almost there!
        </p>
        <p className="mt-1 text-center text-sm leading-relaxed text-foreground/65">
          Next, head to your member portal to manage your account and continue your care.
        </p>
        {isRealOrderId(search.orderId) && (
          <p className="mt-2 text-center text-xs text-foreground/45">Order #{search.orderId}</p>
        )}

        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-white/10 bg-black/20 px-3.5 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#93D3F0]" />
          <p className="text-sm leading-snug text-foreground">
            <span className="font-bold text-[#93D3F0]">Important:</span> Visit your member portal
            below to complete the next steps for your medication.
          </p>
        </div>

        <a
          href={MEMBER_PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex w-full items-center justify-center rounded-full bg-[#CBEAF8] px-6 py-4 text-sm font-bold uppercase tracking-[0.04em] text-[#062B3D] shadow-[0_8px_24px_-10px_rgba(203,234,248,0.45)] transition hover:brightness-105"
        >
          Go to Member Portal
        </a>
        <p className="mt-2 text-center text-xs text-foreground/45">
          Sign in with the email you used at checkout.
        </p>

        <div className="mt-8 border-t border-white/10 pt-5 text-center">
          <p className="text-sm text-foreground/70">
            Questions?{" "}
            <a
              href="mailto:support@restoredelivered.com"
              className="font-medium text-[#93D3F0] hover:underline"
            >
              support@restoredelivered.com
            </a>
          </p>
          <p className="mt-1 text-xs text-foreground/45">We respond during business hours, M–F.</p>
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/"
            search={trackingSearch()}
            className="text-xs font-medium text-foreground/45 hover:text-[#93D3F0]"
          >
            Back to plans
          </Link>
        </div>
      </div>
    </div>
  );
}
