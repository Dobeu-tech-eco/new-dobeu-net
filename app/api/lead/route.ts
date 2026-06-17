import { NextResponse } from "next/server";
import { z } from "zod";
import { processLead } from "@/lib/leads";

const LeadSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().max(255).optional().nullable(),
  company: z.string().max(255).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  source: z.enum(["book", "form", "email", "typeform", "other"]).default("other"),
  utm: z.record(z.string().max(255)).default({}),
  referrer: z.string().max(255).optional().nullable()
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Extract client IP securely, prioritizing Vercel's x-real-ip
  let ip = request.headers.get("x-real-ip");
  if (!ip) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
      const parts = forwardedFor.split(",");
      // Use the rightmost IP to prevent IP spoofing
      ip = parts[parts.length - 1].trim();
    }
  }
  ip = ip || "unknown";

  const rl = await checkRateLimit(`lead:${ip}`, { windowSec: 60, max: 5 });
  if (rl.limited) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "X-RateLimit-Backend": rl.backend } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = LeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { email, name, company, message, source, utm, referrer } = parsed.data;
  const { leadId, apolloContactId } = await processLead({
    email,
    name,
    company,
    message,
    source,
    utm,
    referrer,
    ipHash: hashIp(ip)
  });

  return NextResponse.json({ ok: true, lead_id: leadId, apollo_contact_id: apolloContactId });
}

// ---- helpers ----

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const MAX_BUCKETS = 10000;
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const upstashReady =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) && Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);
const upstashRatelimit = upstashReady
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX, "1 m"),
      prefix: "api:lead"
    })
  : null;

async function isRateLimited(ip: string): Promise<boolean> {
  if (upstashRatelimit) {
    const { success } = await upstashRatelimit.limit(ip);
    return !success;
  }
  const now = Date.now();

  if (ipBuckets.size > 10000) {
    ipBuckets.clear();
  }

  const b = ipBuckets.get(ip);
  if (!b || b.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (b.count >= RATE_LIMIT_MAX) return true;
  b.count += 1;
  return false;
}

function hashIp(ip: string): string {
  // Store a one-way digest so raw IPs are never persisted.
  const digest = createHash("sha256").update(ip).digest("hex").slice(0, 16);
  return `ip_${digest}`;
}

function getClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const lastForwarded = request.headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  return lastForwarded || "unknown";
}
