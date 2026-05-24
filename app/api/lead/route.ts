import { NextResponse } from "next/server";
import { z } from "zod";
import { processLead } from "@/lib/leads";

const LeadSchema = z.object({
  email: z.string().email(),
  name: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  source: z.enum(["book", "form", "email", "typeform", "other"]).default("other"),
  utm: z.record(z.string()).default({}),
  referrer: z.string().optional().nullable()
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Lightweight rate-limit by IP (5/min). In production, prefer Upstash Ratelimit.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
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

async function isRateLimited(ip: string): Promise<boolean> {
  const now = Date.now();

  // Prevent memory exhaustion DoS from spoofed IPs
  if (ipBuckets.size > MAX_BUCKETS) {
    for (const [key, value] of ipBuckets.entries()) {
      if (value.resetAt < now) {
        ipBuckets.delete(key);
      }
    }
    if (ipBuckets.size > MAX_BUCKETS) {
      ipBuckets.clear();
    }
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
  // Light hash — not crypto, just to avoid storing raw IPs
  let h = 0;
  for (let i = 0; i < ip.length; i++) h = ((h << 5) - h + ip.charCodeAt(i)) | 0;
  return `ip_${Math.abs(h).toString(36)}`;
}
