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
 * Resolve the canonical site URL.
 *
 * Why this exists: Vercel inlines `""` (empty string) at build time for
 * env vars marked "sensitive", which silently bypasses `??` (which only
 * catches `null`/`undefined`) and either emits `localhost` in sitemap/robots
 * or throws on `new URL("")` in metadataBase. Every caller MUST go through
 * this helper instead of reading `NEXT_PUBLIC_SITE_URL` directly.
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return raw && raw.length > 0 ? raw : "https://dobeu.net";
}

/**
 * Resolve the PostHog host with the same empty-string guard. Vercel's
 * sensitive-env inlining can also injected `""` here, which would otherwise
 * point the client at an unreachable origin.
 */
export function getPosthogHost(): string {
  const raw = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  return raw && raw.length > 0 ? raw : "https://us.i.posthog.com";
}

/**
 * Parse the `ADMIN_EMAILS` env var into a normalized lowercase allowlist.
 * Exported so middleware and server actions never reparse this themselves.
 */
export function parseAdminEmails(): readonly string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Is the current viewer an admin? Checks email against ADMIN_EMAILS env list.
 * SINGLE SOURCE OF TRUTH for admin gate decisions across the app
 * (middleware + admin layout + future server actions).
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return parseAdminEmails().includes(email.toLowerCase());
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

/**
 * Keep redirect targets on-site to prevent open-redirect abuse.
 * Accept only absolute-path URLs like `/portal` and normalize malformed values.
 */
export function sanitizeNextPath(nextPath: string | null | undefined, fallback = "/portal"): string {
  if (!nextPath) return fallback;
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) return fallback;
  return nextPath;
}
