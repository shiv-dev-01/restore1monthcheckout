import { CouponCodeSection } from "@/components/checkout-v1-ui";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Lock, ShieldCheck, BadgeCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import semaVial from "@/assets/vial-semaglutide.png";
import tirzVial from "@/assets/vial-tirzepatide.png";
import logo from "@/assets/restore-logo.svg";
import {
  INCLUDED_BENEFITS,
  INCLUDED_LINES,
  PLANS,
  PRODUCTS,
  STACK_ADD_ONS,
  money,
  useCheckout,
  type ProductId,
} from "@/lib/checkout";
import { checkoutPrefillSearchSchema } from "@/lib/checkout-prefill";
import { continueToShipping } from "@/lib/continue-to-shipping";
import { fireCheckoutPageWebhook } from "@/lib/lead-webhook";
import { captureTrackingParams, trackingSearch } from "@/lib/tracking-params";
import { applyInputLimit, maxLengthFor, type InputLimit } from "@/lib/input-limits";
import { trackCheckout } from "@/lib/checkout-tracker";

export const Route = createFileRoute("/")({
  validateSearch: (search) => checkoutPrefillSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Checkout — Restore GLP-1 program" },
      {
        name: "description",
        content:
          "Prescription GLP-1 treatment with board-certified provider care, delivered to your door. See if you qualify.",
      },
      { property: "og:title", content: "Checkout — Restore GLP-1 program" },
      {
        property: "og:description",
        content:
          "Prescription GLP-1 treatment with board-certified provider care, delivered to your door. See if you qualify.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WlCheckout,
});

const VIALS: Record<ProductId, string> = {
  semaglutide: semaVial,
  tirzepatide: tirzVial,
};

const STEPS = ["Plan", "Shipping", "Payment"];

function WlCheckout() {
  const navigate = useNavigate();
  const prefill = Route.useSearch();
  const c = useCheckout({ product: prefill.product, planId: prefill.planId });

  useEffect(() => {
    captureTrackingParams(prefill);
    // Call #1 — checkout page load
    trackCheckout({
      status: "started",
      name: `${prefill.fname ?? ""} ${prefill.lname ?? ""}`.trim() || undefined,
      email: prefill.email,
      phone: prefill.phone,
      payload: { planId: prefill.planId ?? c.planId },
    });
  }, [prefill]);

  // Fire lead webhook once for the Plans page (nextvial_v1 pattern)
  useEffect(() => {
    fireCheckoutPageWebhook("plans", {
      first_name: prefill.fname,
      last_name: prefill.lname,
      email: prefill.email,
      phone: prefill.phone,
      state: prefill.state,
      address: prefill.address,
      city: prefill.city,
      zip: prefill.zip,
      med_interest: prefill.product,
      plan: prefill.planId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const product = PRODUCTS[c.product];
  const stack = STACK_ADD_ONS[c.planId];
  const [contactError, setContactError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState(prefill.email ?? "");
  const [promoCode, setPromoCode] = useState<string | undefined>();
  const [promoDiscount, setPromoDiscount] = useState(0);

  // Tracking refs — keep latest field values without causing re-renders
  const trackName = { current: `${prefill.fname ?? ""} ${prefill.lname ?? ""}`.trim() };
  const trackEmail = { current: prefill.email ?? "" };
  const trackPhone = { current: prefill.phone ?? "" };
  const dueToday = Math.max(0, Math.round((c.total - promoDiscount) * 100) / 100);
  // Sum of the static included benefits + plan stack items shown below.
  const bundledValue =
    INCLUDED_BENEFITS.reduce((sum, b) => sum + b.value, 0) + stack.totalValue;

  // Coupon is tied to a specific product_id — clear it when plan/product changes.
  useEffect(() => {
    setPromoCode(undefined);
    setPromoDiscount(0);
  }, [c.product, c.planId]);

  // Call #2 — re-send on blur of each contact field with latest values
  function sendMedicationTrack() {
    trackCheckout({
      status: "started",
      name: trackName.current || undefined,
      email: trackEmail.current || undefined,
      phone: trackPhone.current || undefined,
      payload: {
        planId: c.planId,
        medication: {
          first_name: trackName.current.split(" ")[0] || undefined,
          last_name: trackName.current.split(" ").slice(1).join(" ") || undefined,
          phone: trackPhone.current || undefined,
          email: trackEmail.current || undefined,
        },
      },
    });
  }

  async function handleContinue(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    const result = await continueToShipping({
      variant: "wl",
      product: c.product,
      planId: c.planId,
      total: c.total,
      selectedApiProduct: c.selectedApiProduct,
      firstName: String(fd.get("fname") || ""),
      lastName: String(fd.get("lname") || ""),
      phone: String(fd.get("phone") || ""),
      email: String(fd.get("email") || ""),
      address: prefill.address,
      city: prefill.city,
      state: prefill.state,
      zipCode: prefill.zip,
      promoCode,
      promoDiscount,
    });
    setSubmitting(false);
    if (!result.ok) {
      setContactError(Object.values(result.errors)[0] || "Please fill in all required fields.");
      return;
    }
    setContactError(null);
    navigate({ to: "/checkout/shipping", search: trackingSearch() });
  }

  return (
    <div className="theme-v2-dark min-h-screen bg-[#062B3D] text-foreground antialiased">
      {/* Header with progress */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0A1620]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <img src={logo} alt="Restore Hyper Wellness" className="h-6 w-auto sm:h-7" />
          <ol className="hidden items-center gap-2 text-xs font-semibold sm:flex">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
                    i === 0
                      ? "bg-[#CBEAF8] text-[#062B3D]"
                      : "text-foreground/50"
                  }`}
                >
                  <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                      i === 0 ? "bg-[#062B3D] text-[#CBEAF8]" : "bg-white/10 text-foreground/60"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {s}
                </span>
                {i < STEPS.length - 1 && <span className="h-px w-5 bg-white/15" />}
              </li>
            ))}
          </ol>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/70">
            <Lock className="h-3.5 w-3.5" />
            Secure
          </div>
        </div>
        <div className="h-0.5 w-full bg-white/10 sm:hidden">
          <div className="h-full w-1/3 bg-[#CBEAF8]" />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-12 lg:py-12">
        {/* Left: selection + form */}
        <main className="order-1 pb-28 lg:pb-0">
          {/* Trust row up front */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-foreground/70">
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-[#93D3F0]" /> LegitScript certified
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#93D3F0]" /> Refunded if not approved
            </span>
          </div>

          <section className="mt-6">
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Confirm your plan
            </h1>
            <p className="mt-1.5 text-sm text-foreground/70">
              Your lowest locked price, with every therapy you selected. Shorter terms include
              less.
            </p>

            <div className="mt-5 inline-flex w-full rounded-xl bg-black/25 p-1">
              {(Object.keys(PRODUCTS) as ProductId[]).map((id) => {
                const active = id === c.product;
                return (
                  <button
                    key={id}
                    onClick={() => c.setProduct(id)}
                    aria-pressed={active}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${
                      active
                        ? "bg-[#CBEAF8] text-[#062B3D]"
                        : "text-foreground/65 hover:text-foreground"
                    }`}
                  >
                    {PRODUCTS[id].name}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-2.5">
              {PLANS.filter((p) => p.id === "1").map((p) => {
                const active = p.id === c.planId;
                const monthly = c.pricing[c.product][p.id];
                const save = c.savingsFor(p.id);
                const studioBenefits = STACK_ADD_ONS[p.id].totalValue;
                const studioLine = `+ includes ${money(studioBenefits)} in Restore Studio Benefits`;
                return (
                  <button
                    key={p.id}
                    onClick={() => c.setPlanId(p.id)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-all ${
                      active
                        ? "border-[#93D3F0] bg-[#93D3F0]/12"
                        : "border-white/10 bg-black/15 hover:border-white/25"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        active ? "border-[#93D3F0] bg-[#93D3F0]" : "border-white/25"
                      }`}
                    >
                      {active && <Check className="h-3 w-3 text-[#062B3D]" strokeWidth={4} />}
                    </span>
                    <span className="flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-[15px] font-bold">{p.name}</span>
                        {p.badge && (
                          <span className="rounded-full bg-[#93D3F0] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#062B3D]">
                            {p.badge}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-foreground/70">
                        {save > 0
                          ? `Save ${money(save)} vs monthly ${studioLine}`
                          : `${p.blurb} ${studioLine}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block">
                        <span className="font-display text-lg font-black text-[#CBEAF8]">
                          {money(monthly)}
                        </span>
                        <span className="text-xs text-foreground/60">/mo</span>
                      </span>
                      <span className="block text-[11px] text-foreground/55">
                        {money(PLANS.find((x) => x.id === p.id)!.months * monthly)} today
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-9">
            <h2 className="whitespace-nowrap font-display text-[clamp(1rem,4.4vw,1.5rem)] font-semibold tracking-tight">
              Confirm your personal information
            </h2>
            <form id="checkout-contact-form-wl" className="mt-4" onSubmit={handleContinue}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="First Name"
                  placeholder="John"
                  autoComplete="given-name"
                  name="fname"
                  defaultValue={prefill.fname}
                  onBlur={(e) => {
                    const parts = trackName.current.split(" ");
                    parts[0] = e.target.value;
                    trackName.current = parts.join(" ").trim();
                    sendMedicationTrack();
                  }}
                />
                <Field
                  label="Last Name"
                  placeholder="Doe"
                  autoComplete="family-name"
                  name="lname"
                  defaultValue={prefill.lname}
                  onBlur={(e) => {
                    const parts = trackName.current.split(" ");
                    trackName.current = `${parts[0] ?? ""} ${e.target.value}`.trim();
                    sendMedicationTrack();
                  }}
                />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Phone Number"
                  placeholder="(555) 555-5555"
                  type="tel"
                  autoComplete="tel"
                  name="phone"
                  inputMode="tel"
                  limit="phone"
                  defaultValue={prefill.phone}
                  onBlur={(e) => {
                    trackPhone.current = e.target.value;
                    sendMedicationTrack();
                  }}
                />
                <Field
                  label="Email Address"
                  placeholder="your@email.com"
                  type="email"
                  autoComplete="email"
                  name="email"
                  inputMode="email"
                  defaultValue={prefill.email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={(e) => {
                    trackEmail.current = e.target.value;
                    sendMedicationTrack();
                  }}
                />
              </div>

              {contactError && (
                <p className="mt-4 rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {contactError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-6 hidden w-full items-center justify-between gap-4 rounded-full bg-[#CBEAF8] px-6 py-4 text-left font-bold text-[#062B3D] transition-all hover:-translate-y-0.5 hover:shadow-2xl disabled:opacity-60 lg:flex"
              >
                <span className="text-base">
                  {submitting ? "Saving…" : "Continue to shipping →"}
                </span>
                <span className="font-display text-lg font-black">{money(dueToday)} today</span>
              </button>

              <p className="mt-4 text-xs leading-relaxed text-foreground/75">
                A medical provider will review your information and determine whether treatment is
                right for you. This is a compounded medication. It is not FDA-approved. Actual
                product appearance and labeling of the medication you receive will differ from
                website images.
              </p>
            </form>
          </section>
        </main>

        {/* Right: summary */}
        <aside className="order-2 lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0A1620]">
            <div className="flex items-center gap-4 border-b border-white/10 p-5">
              <img
                src={VIALS[c.product]}
                alt={`${product.name} vial`}
                className="h-24 w-16 shrink-0 object-contain drop-shadow-[0_14px_24px_rgba(0,0,0,0.5)]"
              />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#93D3F0]">
                  {product.tier}
                </div>
                <div className="font-display text-xl font-semibold leading-tight">
                  {product.name}
                </div>
                <div className="mt-1 text-sm text-foreground/80">
                  {c.plan.name} plan · {money(c.monthly)}/mo
                </div>
                <div className="mt-1 text-sm font-bold text-[#CBEAF8]">
                  As low as ${c.perDay.toFixed(2)}/day
                </div>
              </div>
            </div>

            <div className="p-5">
              <dl className="space-y-2 text-sm">
                <Row label={`${c.plan.name} plan`} value={money(c.total)} />
                {c.savings > 0 && (
                  <Row label="Plan savings" value={`−${money(c.savings)}`} highlight />
                )}
                {INCLUDED_LINES.map((l) => (
                  <Row key={l.label} label={l.label} value="Included" strike={money(l.value)} />
                ))}
                <Row
                  label="In-studio service"
                  value="Included"
                  strike={money(stack.totalValue)}
                />
              </dl>

              <div className="mt-4 flex items-baseline justify-between border-t border-dashed border-white/20 pt-4">
                <span className="font-display text-lg font-semibold text-white">Total due today</span>
                <span className="font-display text-3xl font-black text-[#CBEAF8]">
                  {money(dueToday)}
                </span>
              </div>
              {promoDiscount > 0 && (
                <div className="mt-1 text-xs font-semibold text-[#93D3F0]">
                  Coupon saves {money(promoDiscount)}
                </div>
              )}
              {c.savings > 0 && (
                <div className="mt-1 rounded-lg bg-[#93D3F0]/12 px-3 py-2 text-xs font-semibold text-white">
                  You&apos;re saving {money(c.savings)} vs the monthly plan.
                </div>
              )}
              <div className="mt-3 [&_button]:text-white [&_button]:hover:text-white [&_input]:bg-white [&_input]:text-[#12324A]">
                <CouponCodeSection
                  key={`${c.product}-${c.planId}`}
                  email={email}
                  productId={c.selectedApiProduct?.product_id ?? 0}
                  subtotal={c.total}
                  appliedCode={promoCode}
                  onApplied={(code, discount) => {
                    setPromoCode(code);
                    setPromoDiscount(discount);
                  }}
                  onRemoved={() => {
                    setPromoCode(undefined);
                    setPromoDiscount(0);
                  }}
                />
              </div>
            </div>

            <div className="border-t border-white/10 p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/90">
                Included at no extra cost
              </div>
              <ul className="mt-3 space-y-2">
                {INCLUDED_BENEFITS.map((b) => (
                  <li key={b.label} className="flex items-center justify-between gap-4 text-sm">
                    <span className="flex items-center gap-2.5">
                      <span
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: "#93D3F0", color: "#062B3D" }}
                      >
                        <Check className="h-3 w-3" strokeWidth={4} />
                      </span>
                      <span>
                        <span className="font-bold">{b.label}</span>{" "}
                        <span className="text-white/90">{b.detail}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-white/70 line-through">
                      {money(b.value)}
                    </span>
                  </li>
                ))}
                {stack.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-4 text-sm">
                    <span className="flex items-center gap-2.5">
                      <span
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: "#93D3F0", color: "#062B3D" }}
                      >
                        <Check className="h-3 w-3" strokeWidth={4} />
                      </span>
                      <span className="font-bold">{item.label}</span>
                    </span>
                    <span className="shrink-0 text-xs text-white/70 line-through">
                      {money(item.value)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-3 text-sm">
                <span className="text-white/90">Total bundled value</span>
                <span className="font-bold text-[#CBEAF8]">{money(bundledValue)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0A1620]/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <div className="truncate text-[11px] text-foreground/60">
              {product.name} · {c.plan.name}
            </div>
            <div className="font-display text-lg font-black leading-none text-[#CBEAF8]">
              {money(dueToday)}
            </div>
          </div>
          <button
            type="submit"
            form="checkout-contact-form-wl"
            disabled={submitting}
            className="ml-auto shrink-0 rounded-full bg-[#CBEAF8] px-5 py-3 text-sm font-bold text-[#062B3D] disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Continue to shipping →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strike,
  highlight,
}: {
  label: string;
  value: string;
  strike?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-white/90">{label}</dt>
      <dd className="flex items-center gap-2">
        {strike && <span className="text-xs text-white/70 line-through">{strike}</span>}
        <span
          className={
            value === "Included"
              ? "text-[11px] font-bold uppercase tracking-wider text-[#93D3F0]"
              : highlight
                ? "font-semibold text-[#93D3F0]"
                : "font-semibold text-foreground"
          }
        >
          {value}
        </span>
      </dd>
    </div>
  );
}

function Field({
  label,
  placeholder,
  type = "text",
  autoComplete,
  name,
  inputMode,
  limit,
  defaultValue,
  onChange,
  onBlur,
}: {
  label: string;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  name?: string;
  inputMode?: "tel" | "email" | "text";
  limit?: InputLimit;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}) {
  const initialValue =
    defaultValue && limit ? applyInputLimit(limit, defaultValue) : defaultValue;

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-white/90">
        {label}
      </span>
      <input
        type={type}
        name={name}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        defaultValue={initialValue}
        maxLength={limit ? maxLengthFor(limit) : undefined}
        onChange={(e) => {
          if (limit) {
            e.target.value = applyInputLimit(limit, e.target.value);
          }
          onChange?.(e);
        }}
        onBlur={onBlur}
        className="w-full rounded-xl border border-white/15 bg-black/20 px-3.5 py-3 text-sm text-white placeholder:text-white/70 focus:border-[#93D3F0] focus:outline-none focus:ring-2 focus:ring-[#93D3F0]/30"
      />
    </label>
  );
}
