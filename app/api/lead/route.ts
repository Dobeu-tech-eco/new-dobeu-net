import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { assessLead, buildAllowedOrigins } from "@/lib/lead-spam";
import { isLeadSecretUsable, signLeadToken } from "@/lib/lead-verification";
import { sendEmail } from "@/lib/resend";
import { leadVerifyEmail } from "@/lib/resend-templates";

// Whitelisted keys only (matches app/api/typeform/webhook/route.ts) so a
// caller can't stuff an arbitrarily large object into leads.raw_payload.
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

const LeadSchema = z
  .object({
    email: z.string().email().max(254),
    name: z.string().max(200).optional().nullable(),
    company: z.string().max(200).optional().nullable(),
    message: z.string().max(2000).optional().nullable(),
    source: z.enum(["book", "form", "email", "typeform", "other"]).default("other"),
    utm: z
      .object(Object.fromEntries(UTM_KEYS.map((k) => [k, z.string().max(200).optional()])))
      .partial()
      .default({}),
    referrer: z.string().max(2048).optional().nullable(),
    // Bot signals: hidden honeypot and client-measured fill time (ms).
    hp_ref: z.string().max(200).optional(),
    elapsed_ms: z.number().int().min(0).max(86_400_000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.source !== "form") return;
    if ((data.message ?? "").trim().length > 0) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["message"],
      message: "Tell me about the job.",
    });
  });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FRIENDLY_503 =
  "We couldn’t send your confirmation email. Please try again or email jeremyw@dobeu.net.";

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

  const { email, name, company, message, source, utm, referrer, hp_ref, elapsed_ms } = parsed.data;
  const now = Date.now();

  // Silently drop bots: same 200 as a real submission so they get no signal.
  const verdict = assessLead({
    honeypot: hp_ref,
    elapsedMs: elapsed_ms,
    origin: request.headers.get("origin"),
    allowedOrigins: buildAllowedOrigins(),
    message
  });
  if (verdict.spam) {
    console.info(`[api/lead] dropped spam submission: ${verdict.reason}`);
    return NextResponse.json({ ok: true, pending: true });
  }

  const secret = process.env.LEAD_VERIFY_SECRET;
  if (!isLeadSecretUsable(secret)) {
    console.error("[api/lead] LEAD_VERIFY_SECRET not configured (need >= 32 chars)");
    return unavailable();
  }

  if (await isEmailRateLimited(hashEmail(email))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const token = signLeadToken(
    {
      email,
      name: name ?? null,
      company: company ?? null,
      message: message ?? null,
      source,
      // Zod's optional UTM values type as `string | undefined`; drop the undefined entries.
      utm: Object.fromEntries(Object.entries(utm ?? {}).filter(([, v]) => v !== undefined)) as Record<
        string,
        string
      >,
      referrer: referrer ?? null,
      ipHash: hashIp(ip)
    },
    secret,
    now
  );
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://dobeu.net";
  const confirmUrl = `${siteOrigin}/lead/confirm?token=${encodeURIComponent(token)}`;
  const tpl = leadVerifyEmail({ confirmUrl });

  try {
    const sent = await sendEmail({ to: email, subject: tpl.subject, text: tpl.text, html: tpl.html });
    if (!sent.ok) throw new Error(sent.error ?? "send_failed");
  } catch (e) {
    console.error("[api/lead] verification email failed", e instanceof Error ? e.message : e);
    return unavailable();
  }

  return NextResponse.json({ ok: true, pending: true });
}

function unavailable() {
  return NextResponse.json(
    { ok: false, error: FRIENDLY_503 },
    { status: 503, headers: { "Retry-After": "60" } }
  );
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

const EMAIL_LIMITS = [
  { max: 3, windowMs: 60 * 60_000, label: "1 h", prefix: "api:lead:email" },
  { max: 3, windowMs: 24 * 60 * 60_000, label: "24 h", prefix: "api:lead:email-day" }
] as const;
const emailHits = new Map<string, number[]>();
const upstashEmailLimits = upstashReady
  ? EMAIL_LIMITS.map(
      (l) =>
        new Ratelimit({
          redis: Redis.fromEnv(),
          limiter: Ratelimit.slidingWindow(l.max, l.label),
          prefix: l.prefix
        })
    )
  : null;

/** `emailKey` is a hash; raw addresses never reach limiter storage. */
async function isEmailRateLimited(emailKey: string): Promise<boolean> {
  if (upstashEmailLimits) {
    for (const rl of upstashEmailLimits) {
      const { success } = await rl.limit(emailKey);
      if (!success) return true;
    }
    return false;
  }
  const now = Date.now();
  const longest = EMAIL_LIMITS[1].windowMs;
  for (const [key, hits] of emailHits) {
    if (hits.every((t) => now - t >= longest)) emailHits.delete(key);
  }
  const recent = (emailHits.get(emailKey) ?? []).filter((t) => now - t < longest);
  if (EMAIL_LIMITS.some((l) => recent.filter((t) => now - t < l.windowMs).length >= l.max)) return true;
  emailHits.set(emailKey, [...recent, now]);
  return false;
}

function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
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
