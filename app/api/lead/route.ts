import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { processLead } from "@/lib/leads";
import { checkRateLimit } from "@/lib/rate-limit";

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
  // SECURITY: Prioritize x-real-ip to prevent spoofing. With x-forwarded-for, take the
  // rightmost IP — the leftmost is client-controlled and would let a caller bypass the limit.
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip =
    request.headers.get("x-real-ip") ??
    (forwardedFor ? forwardedFor.split(",").pop()?.trim() : "unknown") ??
    "unknown";

  const rl = await checkRateLimit(`lead:${ip}`, { windowSec: 60, max: 5 });
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "X-RateLimit-Backend": rl.backend } }
    );
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

// Store a one-way digest so raw IPs are never persisted.
function hashIp(ip: string): string {
  const digest = createHash("sha256").update(ip).digest("hex").slice(0, 16);
  return `ip_${digest}`;
}
