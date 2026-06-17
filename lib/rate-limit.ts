/**
 * Fixed-window per-key rate limiter.
 *
 * Production path (set both UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * via the Vercel Marketplace Upstash add-on): a single pipelined REST call
 * does INCR + EXPIRE atomically, so the limit holds across every serverless
 * instance.
 *
 * Fallback path: an in-process Map. Per-instance only — fine for local dev,
 * not safe on serverless. Used silently when Upstash env is absent.
 */

interface CheckResult {
  /** True when the request should be blocked (429). */
  limited: boolean;
  /** Current count in the window after this call (best-effort). */
  count?: number;
  /** Driver used — useful for `X-RateLimit-Backend` observability. */
  backend: "upstash" | "memory";
}

interface CheckOptions {
  /** Window length in seconds. */
  windowSec: number;
  /** Max requests per window. */
  max: number;
}

const ipBuckets = new Map<string, { count: number; resetAt: number }>();

function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

export async function checkRateLimit(
  key: string,
  opts: CheckOptions,
): Promise<CheckResult> {
  if (isUpstashConfigured()) {
    try {
      const count = await incrWithExpire(key, opts.windowSec);
      return { limited: count > opts.max, count, backend: "upstash" };
    } catch (e) {
      // Network blip — degrade to in-memory rather than fail open. Log so
      // we notice; never block the request because of a Redis hiccup.
      console.warn("[rate-limit] Upstash error, falling back to memory:", e);
    }
  }
  return checkMemory(key, opts);
}

async function incrWithExpire(key: string, windowSec: number): Promise<number> {
  const url = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  // Single pipelined call — Upstash supports an array-of-commands POST.
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(windowSec), "NX"],
    ]),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const data = (await res.json()) as Array<{ result?: number; error?: string }>;
  const incr = data[0];
  if (incr?.error) throw new Error(incr.error);
  if (typeof incr?.result !== "number")
    throw new Error("Upstash returned non-numeric INCR");
  return incr.result;
}

function checkMemory(key: string, opts: CheckOptions): CheckResult {
  const now = Date.now();
  const windowMs = opts.windowSec * 1000;
  const b = ipBuckets.get(key);
  if (!b || b.resetAt < now) {
    ipBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, count: 1, backend: "memory" };
  }
  b.count += 1;
  return { limited: b.count > opts.max, count: b.count, backend: "memory" };
}

/** Lightweight non-crypto hash to avoid storing raw IPs in lead payloads. */
export function hashIp(ip: string): string {
  let h = 0;
  for (let i = 0; i < ip.length; i++) h = ((h << 5) - h + ip.charCodeAt(i)) | 0;
  return `ip_${Math.abs(h).toString(36)}`;
}
