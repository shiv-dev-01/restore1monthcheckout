/** Shared input masks / digit caps for checkout forms. */

export function digitsOnly(value: string, max?: number) {
  const digits = value.replace(/\D/g, "");
  return typeof max === "number" ? digits.slice(0, max) : digits;
}

export function formatPhone(value: string) {
  const d = digitsOnly(value, 10);
  if (d.length <= 3) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function formatCardNumber(value: string) {
  const d = digitsOnly(value, 16);
  return d.replace(/(.{4})/g, "$1 ").trim();
}

export function formatExpiry(value: string) {
  const d = digitsOnly(value, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

export function formatZip(value: string) {
  return digitsOnly(value, 5);
}

export function formatCvv(value: string) {
  return digitsOnly(value, 4);
}

export type InputLimit =
  | "phone"
  | "card"
  | "expiry"
  | "cvv"
  | "zip"
  | { maxLength: number; digitsOnly?: boolean };

export function applyInputLimit(limit: InputLimit, value: string): string {
  if (typeof limit === "object") {
    const next = limit.digitsOnly ? digitsOnly(value) : value;
    return next.slice(0, limit.maxLength);
  }
  switch (limit) {
    case "phone":
      return formatPhone(value);
    case "card":
      return formatCardNumber(value);
    case "expiry":
      return formatExpiry(value);
    case "cvv":
      return formatCvv(value);
    case "zip":
      return formatZip(value);
  }
}

export function maxLengthFor(limit: InputLimit): number {
  if (typeof limit === "object") return limit.maxLength;
  switch (limit) {
    case "phone":
      return 14; // (555) 555-5555
    case "card":
      return 19; // 16 digits + 3 spaces
    case "expiry":
      return 5; // MM/YY
    case "cvv":
      return 4;
    case "zip":
      return 5;
  }
}
