import { NextResponse } from "next/server";
import { z } from "zod";
import { findLeadByVerifyNonce, processLead } from "@/lib/leads";
import { isLeadSecretUsable, verifyLeadToken } from "@/lib/lead-verification";
import { checkRateLimit } from "@/lib/rate-limit";

// POST only: corporate link scanners issue GETs and must never confirm a lead.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ token: z.string().min(1).max(16384) });

const FRIENDLY_503 = "We couldn’t save your message. Please try again or email jeremyw@dobeu.net.";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const limit = await checkRateLimit(`api:lead:confirm:${ip}`, { windowSec: 60, max: 10 });
  if (limit.limited) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const secret = process.env.LEAD_VERIFY_SECRET;
  if (!isLeadSecretUsable(secret)) {
    console.error("[api/lead/confirm] LEAD_VERIFY_SECRET not configured (need >= 32 chars)");
    return unavailable();
  }

  const result = verifyLeadToken(parsed.data.token, secret, Date.now());
  if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
  const { payload } = result;

  const summary = { source: payload.source, has_message: Boolean(payload.message?.trim()) };
  try {
    // Already confirmed → idempotent success, checked before the lock so a
    // repeat click after a completed confirm never sees "in_progress".
    if (await findLeadByVerifyNonce(payload.nonce)) return NextResponse.json({ ok: true, ...summary });

    // Per-nonce lock: parallel first confirms of one token would otherwise all
    // miss the dedupe lookup and each create a lead. Upstash makes this hold
    // across instances; residual risk is cross-instance races only when Upstash
    // is unset. Note: the /lead/confirm page sends no-referrer, so these POSTs
    // can carry Origin: null — do not add an Origin check here.
    const lock = await checkRateLimit(`lead-confirm-nonce:${payload.nonce}`, { windowSec: 30, max: 1 });
    if (lock.limited) return NextResponse.json({ ok: false, error: "in_progress" }, { status: 409 });

    const { leadId } = await processLead({
      email: payload.email,
      name: payload.name,
      company: payload.company,
      message: payload.message,
      source: payload.source,
      utm: payload.utm,
      referrer: payload.referrer,
      ipHash: payload.ipHash,
      verifyNonce: payload.nonce
    });
    if (!leadId) throw new Error("lead_persistence_failed");
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    console.error("[api/lead/confirm] persistence failed", e instanceof Error ? e.message : e);
    return unavailable();
  }
}

function unavailable() {
  return NextResponse.json(
    { ok: false, error: FRIENDLY_503 },
    { status: 503, headers: { "Retry-After": "60" } }
  );
}
