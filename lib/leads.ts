/**
 * Shared lead-capture fan-out. Any entry point that produces a lead (the public
 * /api/lead form POST, the Calendly webhook, future imports) calls processLead()
 * so the Supabase + Apollo + Customer.io + Resend side effects stay in one place.
 *
 * Every step is best-effort: a failure in one provider never throws out of
 * processLead, so one integration being down can't drop the lead on the floor.
 */
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/server";
import { upsertApolloContact } from "@/lib/apollo";
import { cioIdentify, cioTrack, isCustomerIoConfigured } from "@/lib/customerio";

export type LeadSource = "book" | "form" | "email" | "typeform" | "other";

export interface ProcessLeadInput {
  email: string;
  name?: string | null;
  company?: string | null;
  message?: string | null;
  source: LeadSource;
  utm?: Record<string, string>;
  referrer?: string | null;
  /** Pre-hashed IP for the audit payload (raw IP never stored). Optional. */
  ipHash?: string | null;
}

export interface ProcessLeadResult {
  leadId: string | null;
  apolloContactId?: string;
}

export async function processLead(input: ProcessLeadInput): Promise<ProcessLeadResult> {
  const { email, source } = input;
  const name = input.name ?? null;
  const company = input.company ?? null;
  const message = input.message ?? null;
  const utm = input.utm ?? {};
  const referrer = input.referrer ?? null;

  // 1. Write to Supabase leads table (admin client bypasses RLS).
  // Schema is now unified — write directly to `leads` and surface real errors
  // instead of probing legacy candidate names. If the insert fails, the lead
  // still flows through Apollo / Customer.io / Resend below.
  let leadId: string | null = null;
  try {
    const supa = createAdminClient();
    const { data, error } = await supa
      .from("leads")
      .insert({
        email,
        name,
        company,
        source,
        utm_source: utm.utm_source ?? null,
        utm_medium: utm.utm_medium ?? null,
        utm_campaign: utm.utm_campaign ?? null,
        utm_term: utm.utm_term ?? null,
        utm_content: utm.utm_content ?? null,
        referrer,
        raw_payload: { message, ip_hash: input.ipHash ?? null, ...utm }
      })
      .select("id")
      .single();
    if (error) {
      console.error("[processLead] leads insert failed:", error.message ?? error);
    } else {
      leadId = data?.id ?? null;
    }
  } catch (e) {
    console.error("[processLead] Supabase insert threw", e);
    // Don't fail the flow if Supabase is down — Apollo + email still try.
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
        label_names: [`dobeu.net-${source}`, ...(utm.utm_source ? [`utm_source-${utm.utm_source}`] : [])]
      });
      if (result.ok) apolloContactId = result.contact_id;
      else console.warn("[processLead] Apollo upsert failed:", result.error);
    }
  } catch (e) {
    console.error("[processLead] Apollo upsert threw", e);
  }

  // 3. Backfill Supabase lead with Apollo contact id (best-effort)
  if (leadId && apolloContactId) {
    try {
      const supa = createAdminClient();
      await supa.from("leads").update({ apollo_contact_id: apolloContactId }).eq("id", leadId);
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
      supabase_lead_id: leadId
    };
    const [idRes, trackRes] = await Promise.all([
      cioIdentify({ email, attributes: cioAttrs }),
      cioTrack({ email, name: "lead_captured", data: { source, has_message: !!message, ...utm } })
    ]);
    if (!idRes.ok) console.warn("[processLead] Customer.io identify:", idRes.error);
    if (!trackRes.ok) console.warn("[processLead] Customer.io track:", trackRes.error);
  }

  // 4. Send confirmation email via Resend + notify admin
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? "hello@dobeu.net";
      const replyTo = process.env.RESEND_REPLY_TO ?? "jeremyw@dobeu.net";

      await resend.emails.send({
        from: `Dobeu Tech Solutions <${fromEmail}>`,
        to: email,
        replyTo,
        subject: "Got it — I'll be in touch shortly",
        html: confirmEmailHtml({ name: name ?? "there", source })
      });

      await resend.emails.send({
        from: `dobeu.net <${fromEmail}>`,
        to: replyTo,
        subject: `New lead: ${name ?? email} (${source})`,
        html: notifyEmailHtml({ email, name, company, message, source, utm, referrer })
      });
    }
  } catch (e) {
    console.error("[processLead] Resend failed (non-fatal)", e);
  }

  return { leadId, apolloContactId };
}

// ---- email templates ----

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

export function escapeHtml(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]!);
}
