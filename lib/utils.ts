import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind-aware className merger. Use everywhere classes are composed.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Type-safe env reader. Throws at boot if a required server-side env is missing.
 * Pass `required: false` for optional vars.
 */
export function env(key: string, opts: { required?: boolean } = { required: true }): string {
  const value = process.env[key];
  if ((!value || value.length === 0) && opts.required !== false) {
    if (typeof window === "undefined") {
      throw new Error(`[env] Missing required environment variable: ${key}`);
    }
  }
  return value ?? "";
}

/**
 * Is the current viewer an admin? Checks email against ADMIN_EMAILS env list.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/**
 * Format cents → display currency. Defaults to USD.
 */
export function formatCurrency(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(cents / 100);
}

/**
 * Extract UTM params and referrer from a URL — used by lead capture.
 */
export function captureAcquisition(searchParams: URLSearchParams, referrer = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"]) {
    const v = searchParams.get(key);
    if (v) out[key] = v;
  }
  if (referrer) out.referrer = referrer;
  return out;
}

/**
 * Sleep helper for retry loops.
 */
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
