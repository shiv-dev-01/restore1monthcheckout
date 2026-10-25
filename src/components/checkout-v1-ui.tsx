import fedexIcon from "@/assets/fedex-express.svg";
import logo from "@/assets/restore-logo.svg";
import type { CheckoutVariant } from "@/lib/checkout-session";
import { applyInputLimit, maxLengthFor, type InputLimit } from "@/lib/input-limits";
import {
  checkCoupons,
  COUPON_SITE_ID,
  couponCodeFromResult,
  couponDiscountFromResult,
} from "@/lib/pricing-api";
import { cn } from "@/lib/utils";
import { Lock, Tag } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { useState } from "react";

/** Primary CTA matching Restore dark funnel / plan page. */
export function CheckoutCta({
  children,
  className,
  disabled,
  type = "button",
  form,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  form?: string;
}) {
  return (
    <button
      type={type}
      form={form}
      disabled={disabled}
      className={cn(
        "mx-auto block w-full max-w-[420px] rounded-full bg-[#CBEAF8] px-6 py-3.5 text-center text-[15px] font-bold text-[#062B3D] shadow-[0_8px_24px_-10px_rgba(203,234,248,0.45)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** @deprecated Use CheckoutCta */
export const GradientCta = CheckoutCta;

/** Brand header matching the plans variation — logo left, secure right (full width). */
export function CheckoutFlowHeader({
  variant = "v1",
}: {
  variant?: CheckoutVariant;
}) {
  if (variant === "v2") {
    return (
      <header className="theme-v2-dark w-full border-b border-white/10 bg-[#0A1620] text-foreground">
        <div className="flex w-full items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <img src={logo} alt="Restore Hyper Wellness" className="h-7 w-auto shrink-0" />
          <div className="inline-flex shrink-0 items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/90">
            <Lock className="h-3.5 w-3.5" />
            <span className="leading-tight">
              <span className="block font-bold">Secure</span>
              <span className="block font-normal opacity-80">Payment</span>
            </span>
          </div>
        </div>
      </header>
    );
  }

  if (variant === "v3" || variant === "wl") {
    return (
      <header className="theme-v2-dark sticky top-0 z-30 w-full border-b border-white/10 bg-[#0A1620]/95 text-foreground backdrop-blur">
        <div className="flex w-full items-center justify-between gap-4 px-5 py-3.5 sm:px-8 lg:px-12">
          <img
            src={logo}
            alt="Restore Hyper Wellness"
            className="h-6 w-auto shrink-0 sm:h-7"
          />
          <div className="inline-flex shrink-0 items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/90">
            <Lock className="h-3.5 w-3.5" />
            <span className="leading-tight">
              <span className="block font-bold">Secure</span>
              <span className="block font-normal opacity-80">Payment</span>
            </span>
          </div>
        </div>
      </header>
    );
  }

  // v1 — light header, logo far left / secure far right
  return (
    <header className="sticky top-0 z-30 w-full border-b border-[#E5E9ED] bg-white">
      <div className="flex w-full items-center justify-between gap-4 px-5 py-3.5 sm:px-8 lg:px-12">
        <img
          src={logo}
          alt="Restore Hyper Wellness"
          className="h-7 w-auto shrink-0 sm:h-8"
          style={{
            filter:
              "brightness(0) saturate(100%) invert(23%) sepia(64%) saturate(1735%) hue-rotate(174deg) brightness(93%) contrast(97%)",
          }}
        />
        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          <div className="inline-flex items-center gap-2 rounded-md border border-[#D1DCE5] px-2.5 py-1.5 sm:px-3 sm:py-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#1A2B3C]">
              <Lock className="h-3.5 w-3.5 text-white" />
            </span>
            <span className="text-[10px] uppercase leading-tight tracking-[0.06em] text-[#12324A] sm:text-[11px]">
              <span className="block font-bold">Secure</span>
              <span className="block font-medium">Payment</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export function CheckoutStepProgress({ step }: { step: "approval" | "shipping" | "payment" }) {
  const items = [
    { id: "approval", label: "Approval" },
    { id: "shipping", label: "Shipping" },
    { id: "payment", label: "Payment" },
  ] as const;
  const activeIndex = items.findIndex((i) => i.id === step);

  return (
    <div className="mx-auto w-full max-w-md font-sans">
      <div className="flex items-center justify-between px-1 text-[13px] font-medium">
        {items.map((item, i) => (
          <span
            key={item.id}
            className={i <= activeIndex ? "text-foreground" : "text-foreground/40"}
          >
            {item.label}
          </span>
        ))}
      </div>
      <div className="relative mt-2 h-[3px] w-full rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#93D3F0] transition-all"
          style={{ width: `${((activeIndex + 1) / items.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function ReservationBanner({ secondsLeft }: { secondsLeft: number }) {
  const mm = String(Math.floor(Math.max(0, secondsLeft) / 60)).padStart(2, "0");
  const ss = String(Math.max(0, secondsLeft) % 60).padStart(2, "0");
  const today = new Date().toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

  return (
    <div className="rounded-lg bg-[#1B2A41] px-4 py-3 text-center font-sans text-[13px] text-white sm:px-5">
      <span className="text-white/65">Last Updated {today}</span>
      <span className="mx-2 text-white/35">·</span>
      <span>
        Your prescription program is reserved for{" "}
        <span className="font-semibold text-[#9AD4EC]">
          {mm}:{ss}
        </span>
      </span>
    </div>
  );
}

export function CheckoutLegalFooter() {
  return (
    <div className="mt-12 border-t border-white/10 pt-5 font-sans">
      <div className="space-y-3 text-[11px] leading-[1.55] text-foreground/45">
        <p>
          * Medical services are provided by licensed independent providers. Medications are
          fulfilled by licensed pharmacies. Restore Delivered provides the technology platform that
          enables you to access medical care and pharmacy services and does not itself provide
          medical advice, diagnosis, or treatment, and does not operate as a pharmacy.
        </p>
        <p>
          * We are committed to making our website accessible to all users. If you experience any
          difficulty accessing content or using features, please contact support for assistance.
        </p>
      </div>
    </div>
  );
}

export function RefField({
  label,
  name,
  defaultValue,
  autoComplete,
  inputMode,
  error,
  type = "text",
  placeholder,
  className,
  leading,
  trailing,
  limit,
  onBlur,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  autoComplete?: string;
  inputMode?: "tel" | "email" | "numeric" | "text";
  error?: string;
  type?: string;
  placeholder?: string;
  className?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  limit?: InputLimit;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}) {
  function onChange(e: ChangeEvent<HTMLInputElement>) {
    if (!limit) return;
    e.target.value = applyInputLimit(limit, e.target.value);
  }

  return (
    <label className={cn("block font-sans", className)}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-white/90">
        {label}
      </span>
      <span className="relative block">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            {leading}
          </span>
        )}
        <input
          type={type}
          name={name}
          defaultValue={defaultValue && limit ? applyInputLimit(limit, defaultValue) : defaultValue}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          maxLength={limit ? maxLengthFor(limit) : undefined}
          onChange={onChange}
          onBlur={onBlur}
          className={cn(
            "w-full rounded-xl border border-white/15 bg-black/20 px-3.5 py-3 text-sm text-white placeholder:text-white/70 outline-none transition focus:border-[#93D3F0] focus:ring-2 focus:ring-[#93D3F0]/30",
            leading && "pl-10",
            trailing && "pr-10",
          )}
        />
        {trailing && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            {trailing}
          </span>
        )}
      </span>
      {error && (
        <span className="mt-1 block text-xs text-red-200">{error}</span>
      )}
    </label>
  );
}

export function FedExExpressMark({ className }: { className?: string }) {
  return (
    <img
      src={fedexIcon}
      alt="FedEx Express"
      className={cn("h-8 w-auto sm:h-9", className)}
    />
  );
}

/** Discount savings banner shown above the order ledger. */
export function DiscountSavingsBanner({ amount }: { amount: number }) {
  const display = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  return (
    <div className="flex items-center gap-2 rounded-md border border-[#B7D4E8] bg-[#EAF4FA] px-3 py-2 text-[13px] text-[#165B7C]">
      <Tag className="h-4 w-4 shrink-0" />
      <span>
        Discount{" "}
        <span className="font-semibold">
          ${display.toFixed(display % 1 === 0 ? 0 : 2)} Total Savings
        </span>
      </span>
    </div>
  );
}

/** Coupon row: input + Apply (same apply/remove flow as before). */
export function CouponCodeSection({
  email,
  productId,
  subtotal,
  appliedCode,
  onApplied,
  onRemoved,
  className,
}: {
  email: string;
  productId: number;
  subtotal: number;
  appliedCode?: string;
  onApplied: (code: string, discount: number) => void;
  onRemoved: () => void;
  className?: string;
}) {
  const [code, setCode] = useState(appliedCode ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const applied = Boolean(appliedCode);

  async function apply() {
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Please enter a coupon code");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email first");
      return;
    }
    if (!productId) {
      setError("Please select a plan first");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Same payload shape as koverx_checkout Checkout2.js
      const result = await checkCoupons({
        site_id: COUPON_SITE_ID,
        promo_codes: trimmed,
        product_id: String(productId),
        email: email.trim(),
      });
      if (result.status == 1) {
        const applied = couponCodeFromResult(result, trimmed);
        const discount = couponDiscountFromResult(result, subtotal);
        onApplied(applied, discount);
        setCode(applied);
      } else {
        setError(result.message || "Invalid coupon code");
        onRemoved();
      }
    } catch {
      setError("Failed to apply coupon. Please try again.");
      onRemoved();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError("");
            }}
            placeholder="Enter coupon code"
            disabled={applied || loading}
            className="h-10 min-w-0 flex-1 rounded-md border border-[#D1DCE5] bg-white px-3.5 text-[14px] text-[#1A2B3C] placeholder:text-[#9AA6B0] outline-none focus:border-[#165B7C] focus:ring-1 focus:ring-[#165B7C]/25 disabled:bg-[#F5F7F9]"
          />
          {applied ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCode("");
                setError("");
                onRemoved();
              }}
              className="h-10 shrink-0 cursor-pointer rounded-md bg-[#5B6B78] px-5 text-sm font-semibold text-white transition hover:bg-[#4A5863]"
            >
              Remove
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void apply();
              }}
              disabled={loading || !code.trim()}
              className="h-10 shrink-0 cursor-pointer rounded-md bg-[#6B8494] px-5 text-sm font-semibold text-white transition hover:bg-[#5A7383] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Checking…" : "Apply"}
            </button>
          )}
        </div>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        {applied && !error && (
          <p className="text-sm font-semibold text-[#165B7C]">Coupon applied: {appliedCode}</p>
        )}
      </div>
    </div>
  );
}

export const US_STATE_OPTIONS = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
] as const;
