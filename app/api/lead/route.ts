import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/server";
import { upsertApolloContact } from "@/lib/apollo";
import { cioIdentify, cioTrack, isCustomerIoConfigured } from "@/lib/customerio";

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

  // 1. Write to Supabase leads table (admin client bypasses RLS)
  let supabaseLeadId: string | null = null;
  try {
    const supa = createAdminClient();
    const { data, error } = await supa
      .from("leads")
      .insert({
        email,
        name: name ?? null,
        company: company ?? null,
        source,
        utm_source: utm.utm_source ?? null,
        utm_medium: utm.utm_medium ?? null,
        utm_campaign: utm.utm_campaign ?? null,
        utm_term: utm.utm_term ?? null,
        utm_content: utm.utm_content ?? null,
        referrer: referrer ?? null,
        raw_payload: { message, ip_hash: hashIp(ip), ...utm }
      })
      .select("id")
      .single();
    if (error) throw error;
    supabaseLeadId = data?.id ?? null;
  } catch (e) {
    console.error("[/api/lead] Supabase insert failed", e);
    // Don't fail the user-facing flow if Supabase is down — Apollo + email still try.
  }

  // 2. Upsert Apollo contact (server-side, key in env)
  let apolloContactId: string | undefined;
  try {
    if (process.env.APOLLO_API_KEY) {
      const split = (name ?? "").split(/\s+/);
      const result = await upsertApolloContact({
        email,
        first_name: split[0],
        last_name: split.length > 1 ? split.slice(1).join(" ") : undefined,
        organization_name: company ?? undefined,
        label_names: [
          `dobeu.net-${source}`,
          ...(utm.utm_source ? [`utm_source-${utm.utm_source}`] : [])
        ]
      });
      if (result.ok) apolloContactId = result.contact_id;
      else console.warn("[/api/lead] Apollo upsert failed:", result.error);
    }
  } catch (e) {
    console.error("[/api/lead] Apollo upsert threw", e);
  }

  // 3. Update Supabase lead with Apollo contact id (best-effort)
  if (supabaseLeadId && apolloContactId) {
    try {
      const supa = createAdminClient();
      await supa.from("leads").update({ apollo_contact_id: apolloContactId }).eq("id", supabaseLeadId);
    } catch {
      /* non-fatal */
    }
  }

  // 3.5 Customer.io: identify + fire "lead_captured" event (kicks off welcome sequence)
  if (isCustomerIoConfigured()) {
    const cioAttrs = {
      name: name ?? undefined,
      company: company ?? undefined,
      first_seen_source: source,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      referrer: referrer ?? undefined,
      apollo_contact_id: apolloContactId,
      supabase_lead_id: supabaseLeadId
    };
    const [idRes, trackRes] = await Promise.all([
      cioIdentify({ email, attributes: cioAttrs }),
      cioTrack({
        email,
        name: "lead_captured",
        data: { source, has_message: !!message, ...utm }
      })
    ]);
    if (!idRes.ok) console.warn("[/api/lead] Customer.io identify:", idRes.error);
    if (!trackRes.ok) console.warn("[/api/lead] Customer.io track:", trackRes.error);
  }

  // 4. Send confirmation email via Resend + notify admin
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? "hello@dobeu.net";

      // Confirmation to lead
      await resend.emails.send({
        from: `Dobeu Tech Solutions <${fromEmail}>`,
        to: email,
        replyTo: process.env.RESEND_REPLY_TO ?? "jeremyw@dobeu.net",
        subject: "Got it — I'll be in touch shortly",
        html: confirmEmailHtml({ name: name ?? "there", source })
      });

      // Notify Jeremy
      await resend.emails.send({
        from: `dobeu.net <${fromEmail}>`,
        to: process.env.RESEND_REPLY_TO ?? "jeremyw@dobeu.net",
        subject: `New lead: ${name ?? email} (${source})`,
        html: notifyEmailHtml({ email, name, company, message, source, utm, referrer })
      });
    }
  } catch (e) {
    console.error("[/api/lead] Resend failed (non-fatal)", e);
  }

  return NextResponse.json({
    ok: true,
    lead_id: supabaseLeadId,
    apollo_contact_id: apolloContactId
  });
}

// ---- helpers ----

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const ipBuckets = new Map<string, { count: number; resetAt: number }>();

async function isRateLimited(ip: string): Promise<boolean> {
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
  // Light hash — not crypto, just to avoid storing raw IPs
  let h = 0;
  for (let i = 0; i < ip.length; i++) h = ((h << 5) - h + ip.charCodeAt(i)) | 0;
  return `ip_${Math.abs(h).toString(36)}`;
}

function confirmEmailHtml(args: { name: string; source: string }): string {
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#1A1A2E;max-width:560px;margin:0 auto;padding:24px;">
    <h2 style="margin:0 0 16px;font-size:22px;">Hey ${escapeHtml(args.name)} —</h2>
    <p style="margin:0 0 16px;">Got your note. I personally read every inquiry and reply within 24 hours (usually faster).</p>
    <p style="margin:0 0 16px;">If you booked a call, expect a calendar invite shortly. Otherwise, I'll be in touch with next steps.</p>
    <p style="margin:0 0 24px;">— Jeremy<br/>Dobeu Tech Solutions</p>
    <p style="font-size:12px;color:#666;border-top:1px solid #eee;padding-top:12px;">This was triggered by you submitting the <strong>${escapeHtml(args.source)}</strong> form on dobeu.net.</p>
  </div>`;
}

function notifyEmailHtml(args: Record<string, unknown>): string {
  const rows = Object.entries(args)
    .filter(([, v]) => v && (typeof v !== "object" || Object.keys(v as object).length > 0))
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;font-weight:600;color:#666;">${escapeHtml(k)}</td><td style="padding:6px 12px;">${escapeHtml(JSON.stringify(v))}</td></tr>`
    )
    .join("");
  return `<div style="font-family:-apple-system,sans-serif;"><h2>New lead from dobeu.net</h2><table style="border-collapse:collapse;">${rows}</table></div>`;
}

function escapeHtml(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]!));
}
