import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { processLead } from "@/lib/leads";

// Whitelisted keys only (matches app/api/typeform/webhook/route.ts) so a
// caller can't stuff an arbitrarily large object into leads.raw_payload.
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

const LeadSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().max(200).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  source: z.enum(["book", "form", "email", "typeform", "other"]).default("other"),
  utm: z
    .object(Object.fromEntries(UTM_KEYS.map((k) => [k, z.string().max(200).optional()])))
    .partial()
    .default({}),
  referrer: z.string().max(2048).optional().nullable()
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (await isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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
    // Zod's optional UTM values type as `string | undefined`; processLead wants
    // a clean Record<string, string>, so drop the undefined entries here.
    utm: utm
      ? (Object.fromEntries(Object.entries(utm).filter(([, v]) => v !== undefined)) as Record<
          string,
          string
        >)
      : undefined,
    referrer,
    ipHash: hashIp(ip)
  });

  return NextResponse.json({ ok: true, lead_id: leadId, apollo_contact_id: apolloContactId });
}

// ---- helpers ----

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
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
  // First entry in x-forwarded-for is the original client; each proxy hop
  // appends its own IP after it, so the last entry is the nearest proxy, not
  // the client. Matches the same resolution used in app/api/github-repo/route.ts.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}
