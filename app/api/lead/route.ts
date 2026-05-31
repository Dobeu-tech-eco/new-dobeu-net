import { NextResponse } from "next/server";
import { z } from "zod";
import { processLead } from "@/lib/leads";
import { checkRateLimit, hashIp } from "@/lib/rate-limit";

const LeadSchema = z.object({
  email: z.string().email(),
  name: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  source: z
    .enum(["book", "form", "email", "typeform", "other"])
    .default("other"),
  utm: z.record(z.string()).default({}),
  referrer: z.string().optional().nullable(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parts = request.headers.get("x-forwarded-for")?.split(",") ?? [];
  const ip = parts[parts.length - 1]?.trim() || "unknown";
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
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
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
    ipHash: hashIp(ip),
  });

  return NextResponse.json({
    ok: true,
    lead_id: leadId,
    apollo_contact_id: apolloContactId,
  });
}
