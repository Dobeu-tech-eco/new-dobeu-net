/**
 * Shared lead-capture fan-out. Any entry point that produces a lead (the public
 * /api/lead form POST, the Calendly webhook, future imports) calls processLead()
 * so the Supabase + Apollo + Customer.io + Resend side effects stay in one place.
 *
 * Every step is best-effort: a failure in one provider never throws out of
 * processLead, so one integration being down can't drop the lead on the floor.
 */
import { createAdminClient } from "@/lib/supabase/server";
import { upsertApolloContact } from "@/lib/apollo";
import { cioIdentify, cioTrack, isCustomerIoConfigured } from "@/lib/customerio";
import { sendEmail } from "@/lib/resend";
import {
  leadConfirmationToClient,
  leadAdminNotification
} from "@/lib/resend-templates";

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

  // 4. Send confirmation email via Resend + notify admin (Phase 3: now uses
  // shared templates so visual language matches work-order + invoice emails).
  try {
    const replyTo = process.env.RESEND_REPLY_TO ?? "jeremyw@dobeu.net";
    const confirm = leadConfirmationToClient({ name, source });
    await sendEmail({
      to: email,
      subject: confirm.subject,
      text: confirm.text,
      html: confirm.html
    });
    const notify = leadAdminNotification({
      email,
      name,
      company,
      message,
      source,
      utm,
      referrer
    });
    await sendEmail({
      to: replyTo,
      subject: notify.subject,
      text: notify.text,
      html: notify.html
    });
  } catch (e) {
    console.error("[processLead] Resend failed (non-fatal)", e);
  }

  return { leadId, apolloContactId };
}

/** Retained as a public utility; some legacy callers used to import this. */
export function escapeHtml(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]!
  );
}
