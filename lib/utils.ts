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
 * Origin for Supabase magic-link `emailRedirectTo` callbacks.
 *
 * - localhost / *.vercel.app → use the live browser origin (dev + preview).
 * - Production custom domain → `getSiteUrl()` so links always target
 *   `https://dobeu.net` even if Supabase Site URL is misconfigured.
 */
export function resolveAuthOrigin(): string {
  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (hostname === "localhost" || hostname.endsWith(".vercel.app")) {
      return origin;
    }
  }
  return getSiteUrl();
}

/**
 * Build the Supabase `emailRedirectTo` URL for magic-link sign-in.
 * Always routes through `/auth/callback` with a sanitized `next` param.
 */
export function buildAuthCallbackUrl(nextPath: string, fallback = "/portal"): string {
  const safeNext = sanitizeNextPath(nextPath, fallback);
  const base = resolveAuthOrigin().replace(/\/$/, "");
  return `${base}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}

/**
 * Keep redirect targets on-site to prevent open-redirect abuse.
 * Accept only absolute-path URLs like `/portal` and normalize malformed values.
 */
export function sanitizeNextPath(nextPath: string | null | undefined, fallback = "/portal"): string {
  if (!nextPath) return fallback;
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) return fallback;
  return nextPath;
}

/** Assurance-level shape returned by `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`. */
export type AssuranceLevel = { currentLevel: string | null; nextLevel: string | null } | null;

/**
 * Decide whether the current session must complete an AAL2 (TOTP) step-up.
 * - nextLevel 'aal2' + currentLevel not 'aal2' → a factor exists but the
 *   session hasn't satisfied it → step-up required.
 * - No factor enrolled (currentLevel === nextLevel === 'aal1') → not a step-up
 *   case (that's handled by `requiresMfaEnrollment` for admins).
 */
export function requiresAal2Stepup(aal: AssuranceLevel): boolean {
  if (!aal) return false;
  return aal.nextLevel === "aal2" && aal.currentLevel !== "aal2";
}

/**
 * Decide whether the caller must be FORCED to enroll a TOTP factor before
 * reaching the admin surface. MFA is MANDATORY for admins: an admin with no
 * verified factor (so the session can never reach AAL2) is redirected to
 * `/portal/settings/mfa` to enroll — a soft banner is not sufficient.
 *
 * - Non-admins are never forced to enroll (returns false) — keeps `/portal`
 *   reachable and prevents redirect loops (the enrollment page lives under
 *   `/portal`, which must never be MFA-gated).
 * - Admins with no AAL2-capable session (`currentLevel !== "aal2"`, which
 *   covers the unenrolled aal1/aal1 case) must enroll.
 * - Fail CLOSED on a null/unknown assurance shape: an admin with indeterminate
 *   MFA state is treated as needing enrollment (the admin surface is sensitive).
 *
 * NOTE: this is intentionally satisfied by the SAME redirect target as
 * `requiresAal2Stepup`, so middleware can OR the two conditions together.
 */
export function requiresMfaEnrollment(aal: AssuranceLevel, isAdmin: boolean): boolean {
  if (!isAdmin) return false;
  if (!aal) return true; // fail closed: indeterminate MFA state for an admin
  return aal.currentLevel !== "aal2";
}

