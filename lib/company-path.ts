import { sanitizeNextPath } from "@/lib/utils";

/**
 * Request header carrying the requested /company path + query to server
 * components (the layout cannot read the URL otherwise). Set only by the
 * session middleware; any inbound value is always discarded there.
 */
export const COMPANY_PATH_HEADER = "x-dobeu-pathname";

const BASE = "https://x.invalid";
const MAX_LENGTH = 2048;

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

// True when any path segment is "." or "..", including percent-encoded forms
// (checked on the raw, once-decoded and twice-decoded path).
function hasDotSegment(rawPath: string): boolean {
  const once = safeDecode(rawPath);
  if (once === null) return true;
  const twice = safeDecode(once);
  if (twice === null) return true;
  return [rawPath, once, twice].some((p) => p.split("/").some((s) => s === "." || s === ".."));
}

/**
 * Validated same-site /company deep link (path + query, no hash) from an
 * untrusted value such as the forwarded request header. Anything that is not
 * exactly /company or under /company/, or that contains dot segments or would be
 * normalized by URL parsing, or is longer than 2048 chars, yields `fallback` (returned as given; it is
 * caller-controlled and trusted). Pure; one validator shared by the layout and
 * every page so whichever redirect wins carries the identical `next`.
 */
export function companyDeepLink(
  value: string | null | undefined,
  fallback = "/company"
): string {
  if (value && value.length > MAX_LENGTH) return fallback;
  const safe = sanitizeNextPath(value, fallback);
  if (safe === fallback) return fallback;
  const rawPath = safe.split(/[?#]/, 1)[0];
  if (hasDotSegment(rawPath)) return fallback;
  // sanitizeNextPath guarantees a same-origin relative path, so this cannot throw.
  const parsed = new URL(safe, BASE);
  if (parsed.pathname !== rawPath) return fallback;
  if (parsed.pathname !== "/company" && !parsed.pathname.startsWith("/company/")) return fallback;
  return parsed.pathname + parsed.search;
}
