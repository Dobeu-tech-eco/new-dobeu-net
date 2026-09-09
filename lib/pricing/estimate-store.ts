/**
 * Persistence and delivery for computed estimates.
 *
 * Mirrors the best-effort contract of `lib/leads.ts`: every side effect is
 * wrapped, and a failure in one never prevents the others. A Resend outage
 * must not lose the stored estimate, and a Supabase outage must not stop the
 * client's email.
 *
 * Deliberately NOT a `"use server"` module — it takes a service-role client
 * and performs no authorization of its own. The only caller is the signed
 * Typeform webhook, which authenticates by HMAC before reaching here.
 */
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend";
import { estimateAdminNotification, estimateToClient } from "@/lib/resend-templates";
import type { EstimateResult } from "./estimate";
import type { IntakeContact, IntakeNarrative } from "./intake";

export interface DeliverEstimateArgs {
  readonly contact: IntakeContact;
  readonly estimate: EstimateResult;
  readonly narrative: IntakeNarrative;
  readonly labels: Readonly<Record<string, readonly string[]>>;
  readonly inputs: unknown;
  readonly leadId: string | null;
  readonly formId: string | null;
  readonly responseId: string | null;
}

export interface DeliverEstimateResult {
  readonly token: string;
  readonly estimateId: string | null;
  readonly stored: boolean;
  readonly emailedClient: boolean;
}

/** 32 hex chars — a capability handle for /estimate/<token>, not a password. */
export function newEstimateToken(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Query builder for the `estimates` table.
 *
 * `estimates` is new in migration 20260829000000. Until `pnpm db:types` is run
 * against that migration, the generated `Database` type has no entry for it and
 * the typed client rejects `.from("estimates")`. Widening to the untyped
 * `SupabaseClient` here is the entire workaround, kept in one place so it is
 * easy to delete.
 *
 * TODO(db-types): run `pnpm db:types`, then drop this helper and call
 * `client.from("estimates")` directly for full row typing.
 */
export function estimatesTable(client: unknown) {
  return (client as SupabaseClient).from("estimates");
}

function toRow(args: DeliverEstimateArgs, token: string) {
  const { contact, estimate } = args;
  return {
    token,
    lead_id: args.leadId,
    form_id: args.formId,
    response_id: args.responseId,
    email: contact.email,
    name: contact.name,
    company: contact.company,
    rate_card_version: estimate.rateCardVersion,
    track: estimate.track,
    amount_low: estimate.low,
    amount_mid: estimate.midpoint,
    amount_high: estimate.high,
    total_hours: estimate.totalHours,
    confidence: estimate.confidence,
    budget_fit: estimate.budgetFit,
    breakdown: {
      lineItems: estimate.lineItems,
      uplifts: estimate.uplifts,
      multipliers: estimate.multipliers,
      subtotal: estimate.subtotal,
      spread: estimate.spread,
      unknownCount: estimate.unknownCount,
      monthlyRetainer: estimate.monthlyRetainer,
      retainerKind: estimate.retainerKind,
      reviewFlags: estimate.reviewFlags,
      labels: args.labels
    },
    inputs: args.inputs,
    narrative: args.narrative
  };
}

/**
 * Stores the estimate and emails it to the client and to Jeremy.
 *
 * Upserts on `response_id` so a Typeform webhook retry updates the existing
 * row instead of minting a second estimate for the same submission.
 */
export async function persistAndDeliverEstimate(
  args: DeliverEstimateArgs
): Promise<DeliverEstimateResult> {
  const token = newEstimateToken();
  const { contact, estimate } = args;

  let estimateId: string | null = null;
  let storedToken = token;
  let stored = false;

  try {
    const supa = createAdminClient();
    const { data, error } = await estimatesTable(supa)
      .upsert(toRow(args, token), { onConflict: "response_id" })
      .select("id, token")
      .single();
    if (error) {
      console.error("[estimate] insert failed:", error.message ?? error);
    } else {
      estimateId = data?.id ?? null;
      // A retry returns the ORIGINAL token — reuse it so any link already in
      // the client's inbox keeps resolving.
      storedToken = data?.token ?? token;
      stored = true;
    }
  } catch (e) {
    console.error("[estimate] Supabase upsert threw", e);
  }

  let emailedClient = false;
  if (contact.email) {
    try {
      const clientEmail = estimateToClient({ contact: { ...contact }, estimate, token: storedToken });
      const result = await sendEmail({
        to: contact.email,
        subject: clientEmail.subject,
        text: clientEmail.text,
        html: clientEmail.html
      });
      emailedClient = result.ok;
      if (!result.ok) console.warn("[estimate] client email failed:", result.error);
    } catch (e) {
      console.error("[estimate] client email threw", e);
    }
  }

  try {
    const adminTo = process.env.RESEND_REPLY_TO ?? "jeremyw@dobeu.net";
    const adminEmail = estimateAdminNotification({
      contact: { ...contact },
      estimate,
      token: storedToken,
      narrative: { ...args.narrative },
      labels: { ...args.labels }
    });
    await sendEmail({
      to: adminTo,
      subject: adminEmail.subject,
      text: adminEmail.text,
      html: adminEmail.html
    });
  } catch (e) {
    console.error("[estimate] admin email threw", e);
  }

  if (stored && emailedClient) {
    try {
      const supa = createAdminClient();
      await estimatesTable(supa).update({ emailed_at: new Date().toISOString() }).eq("token", storedToken);
    } catch {
      /* non-fatal — the estimate exists and the client has it */
    }
  }

  return { token: storedToken, estimateId, stored, emailedClient };
}
