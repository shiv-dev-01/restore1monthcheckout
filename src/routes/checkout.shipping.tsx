import {
  CheckoutCta,
  CheckoutFlowHeader,
  CheckoutLegalFooter,
  CheckoutStepProgress,
  RefField,
  US_STATE_OPTIONS,
} from "@/components/checkout-v1-ui";
import { money } from "@/lib/checkout";
import {
  loadCheckoutSession,
  sessionAmountDue,
  updateCheckoutSession,
  validateContact,
  validateShipping,
  type CheckoutSession,
} from "@/lib/checkout-session";
import { fireCheckoutPageWebhook, saveLeadAnswers } from "@/lib/lead-webhook";
import { parseTrackingSearch, trackingSearch } from "@/lib/tracking-params";
import { trackCheckout } from "@/lib/checkout-tracker";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";

export const Route = createFileRoute("/checkout/shipping")({
  validateSearch: (search) => parseTrackingSearch(search),
  head: () => ({
    meta: [
      { title: "Shipping — Restore Delivered" },
      {
        name: "description",
        content: "Enter your shipping address to continue your Restore GLP-1 order.",
      },
    ],
  }),
  component: ShippingPage,
});

const selectClass =
  "w-full rounded-xl border border-white/15 bg-black/20 px-3.5 py-3 text-sm text-foreground outline-none focus:border-[#93D3F0] focus:ring-2 focus:ring-[#93D3F0]/30";

function ShippingPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [useDifferentBilling, setUseDifferentBilling] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Tracking refs for shipping fields
  const sh = {
    name: { current: "" },
    email: { current: "" },
    phone: { current: "" },
    street: { current: "" },
    apartment: { current: "" },
    city: { current: "" },
    state: { current: "" },
    zip: { current: "" },
  };

  useEffect(() => {
    const stored = loadCheckoutSession();
    if (!stored?.email) {
      navigate({ to: "/", search: trackingSearch() });
      return;
    }
    setSession(stored);
    setUseDifferentBilling(stored.billingSameAsShipping === false);
    // Seed tracking refs from stored session
    sh.name.current = `${stored.firstName} ${stored.lastName}`.trim();
    sh.email.current = stored.email ?? "";
    sh.phone.current = stored.phone ?? "";
    sh.street.current = stored.address ?? "";
    sh.apartment.current = stored.address2 ?? "";
    sh.city.current = stored.city ?? "";
    sh.state.current = stored.state ?? "";
    sh.zip.current = stored.zipCode ?? "";
  }, [navigate]);

  // Fire lead webhook once for Shipping after checkout session is loaded
  useEffect(() => {
    if (!session?.email) return;
    fireCheckoutPageWebhook("shipping", {
      first_name: session.firstName,
      last_name: session.lastName,
      email: session.email,
      phone: session.phone,
      state: session.state,
      address: session.address,
      city: session.city,
      zip: session.zipCode,
    });
  }, [session]);

  if (!session) {
    return (
      <div className="theme-v2-dark flex min-h-screen items-center justify-center bg-[#062B3D] font-sans text-sm text-foreground/70">
        Loading…
      </div>
    );
  }

  // Call #3 — re-send on blur of each shipping field
  function sendShippingTrack() {
    if (!session) return;
    trackCheckout({
      status: "started",
      name: sh.name.current || undefined,
      email: sh.email.current || undefined,
      phone: sh.phone.current || undefined,
      payload: {
        planId: session.planId,
        shipping: {
          name: sh.name.current || undefined,
          email: sh.email.current || undefined,
          phone: sh.phone.current || undefined,
          street: sh.street.current || undefined,
          apartment: sh.apartment.current || undefined,
          city: sh.city.current || undefined,
          state: sh.state.current || undefined,
          zip: sh.zip.current || undefined,
        },
      },
    });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const fullName = String(fd.get("name") || "").trim();
    const spaceIdx = fullName.indexOf(" ");
    const firstName = spaceIdx === -1 ? fullName : fullName.slice(0, spaceIdx);
    const lastName = spaceIdx === -1 ? "" : fullName.slice(spaceIdx + 1).trim();
    const phone = String(fd.get("phone") || "");
    const email = String(fd.get("email") || "");
    const fields = {
      address: String(fd.get("address") || ""),
      address2: String(fd.get("address2") || ""),
      city: String(fd.get("city") || ""),
      state: String(fd.get("state") || ""),
      zipCode: String(fd.get("zip") || ""),
      billingSameAsShipping: !useDifferentBilling,
      billingAddress: String(fd.get("billingAddress") || ""),
      billingAddress2: String(fd.get("billingAddress2") || ""),
      billingCity: String(fd.get("billingCity") || ""),
      billingState: String(fd.get("billingState") || ""),
      billingZipCode: String(fd.get("billingZip") || ""),
    };

    const nextErrors = {
      ...validateContact({ firstName, lastName, phone, email }),
      ...validateShipping(fields),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    updateCheckoutSession({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: fields.address.trim(),
      address2: fields.address2.trim() || undefined,
      city: fields.city.trim(),
      state: fields.state,
      zipCode: fields.zipCode.trim(),
      billingSameAsShipping: !useDifferentBilling,
      billingAddress: useDifferentBilling ? fields.billingAddress.trim() : undefined,
      billingAddress2: useDifferentBilling
        ? fields.billingAddress2.trim() || undefined
        : undefined,
      billingCity: useDifferentBilling ? fields.billingCity.trim() : undefined,
      billingState: useDifferentBilling ? fields.billingState : undefined,
      billingZipCode: useDifferentBilling ? fields.billingZipCode.trim() : undefined,
    });
    saveLeadAnswers({
      state: fields.state,
      zip: fields.zipCode.trim(),
    });
    setSubmitting(false);
    navigate({ to: "/checkout/payment", search: trackingSearch() });
  }

  return (
    <div className="theme-v2-dark min-h-screen bg-[#062B3D] font-sans text-foreground antialiased">
      <CheckoutFlowHeader variant={session.variant} />
      <div className="mx-auto max-w-[560px] px-4 py-8 sm:px-6">
        <CheckoutStepProgress step="shipping" />

        <h1 className="mt-8 font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-foreground">
          Confirm Your Shipping Address
        </h1>

        <form className="mt-5" onSubmit={onSubmit}>
          <div className="space-y-4 rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5">
            <RefField
              label="Name"
              name="name"
              defaultValue={`${session.firstName} ${session.lastName}`.trim()}
              autoComplete="name"
              error={errors.firstName || errors.lastName}
              onBlur={(e) => { sh.name.current = e.target.value; sendShippingTrack(); }}
            />
            <RefField
              label="Email"
              name="email"
              type="email"
              defaultValue={session.email}
              autoComplete="email"
              inputMode="email"
              error={errors.email}
              onBlur={(e) => { sh.email.current = e.target.value; sendShippingTrack(); }}
            />
            <RefField
              label="Phone"
              name="phone"
              type="tel"
              defaultValue={session.phone}
              autoComplete="tel"
              inputMode="tel"
              error={errors.phone}
              limit="phone"
              onBlur={(e) => { sh.phone.current = e.target.value; sendShippingTrack(); }}
            />
            <RefField
              label="Street Address"
              name="address"
              defaultValue={session.address}
              autoComplete="address-line1"
              error={errors.address}
              onBlur={(e) => { sh.street.current = e.target.value; sendShippingTrack(); }}
            />
            <RefField
              label="Apartment, Suite, etc. (Optional)"
              name="address2"
              defaultValue={session.address2}
              autoComplete="address-line2"
              onBlur={(e) => { sh.apartment.current = e.target.value; sendShippingTrack(); }}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <RefField
                label="City"
                name="city"
                defaultValue={session.city}
                autoComplete="address-level2"
                error={errors.city}
                onBlur={(e) => { sh.city.current = e.target.value; sendShippingTrack(); }}
              />
              <label className="block font-sans">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-foreground/65">
                  State
                </span>
                <select
                  name="state"
                  defaultValue={session.state || "CA"}
                  className={selectClass}
                  onBlur={(e) => { sh.state.current = e.target.value; sendShippingTrack(); }}
                >
                  {US_STATE_OPTIONS.map((s) => (
                    <option key={s.code} value={s.code} className="bg-[#0A1620] text-foreground">
                      {s.name}
                    </option>
                  ))}
                </select>
                {errors.state && (
                  <span className="mt-1 block text-xs text-red-200">{errors.state}</span>
                )}
              </label>
            </div>
            <RefField
              label="ZIP Code"
              name="zip"
              defaultValue={session.zipCode}
              autoComplete="postal-code"
              inputMode="numeric"
              error={errors.zipCode}
              limit="zip"
              onBlur={(e) => { sh.zip.current = e.target.value; sendShippingTrack(); }}
            />

            <label className="flex cursor-pointer items-center gap-2.5 pt-1 text-[14px] text-foreground">
              <span
                className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
                  useDifferentBilling ? "border-[#93D3F0]" : "border-white/30"
                }`}
              >
                {useDifferentBilling && <span className="h-2 w-2 rounded-full bg-[#93D3F0]" />}
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={useDifferentBilling}
                onChange={(e) => setUseDifferentBilling(e.target.checked)}
              />
              Use different billing address
            </label>

            {useDifferentBilling && (
              <div className="space-y-4 border-t border-white/10 pt-4">
                <RefField
                  label="Billing Street Address"
                  name="billingAddress"
                  defaultValue={session.billingAddress}
                  error={errors.billingAddress}
                />
                <RefField
                  label="Apartment, Suite, etc. (Optional)"
                  name="billingAddress2"
                  defaultValue={session.billingAddress2}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <RefField
                    label="Billing City"
                    name="billingCity"
                    defaultValue={session.billingCity}
                    error={errors.billingCity}
                  />
                  <label className="block font-sans">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-foreground/65">
                      Billing State
                    </span>
                    <select
                      name="billingState"
                      defaultValue={session.billingState || "CA"}
                      className={selectClass}
                    >
                      {US_STATE_OPTIONS.map((s) => (
                        <option key={s.code} value={s.code} className="bg-[#0A1620] text-foreground">
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {errors.billingState && (
                      <span className="mt-1 block text-xs text-red-200">{errors.billingState}</span>
                    )}
                  </label>
                </div>
                <RefField
                  label="Billing ZIP Code"
                  name="billingZip"
                  defaultValue={session.billingZipCode}
                  inputMode="numeric"
                  error={errors.billingZipCode}
                  limit="zip"
                />
              </div>
            )}
          </div>

          <div className="mt-10 flex flex-col items-center text-center">
            <p className="max-w-md text-[13px] leading-relaxed text-foreground/65">
              All approved orders are processed within 24 hours. Total estimated delivery time is
              1-5 business days from prescription approval.
            </p>
          </div>

          <div className="mt-8">
            <div className="mb-3 text-center text-[15px] font-semibold text-foreground">
              Total due today:{" "}
              <span className="text-[#CBEAF8]">{money(sessionAmountDue(session))}</span>
              {session.promoCode && (session.promoDiscount ?? 0) > 0 && (
                <span className="mt-1 block text-[12px] font-medium text-[#93D3F0]">
                  Coupon {session.promoCode} applied (−{money(session.promoDiscount ?? 0)})
                </span>
              )}
            </div>
            <CheckoutCta type="submit" disabled={submitting}>
              Continue to Checkout →
            </CheckoutCta>
          </div>
        </form>

        <CheckoutLegalFooter />
      </div>
    </div>
  );
}
