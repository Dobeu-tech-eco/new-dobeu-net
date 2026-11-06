/**
 * Service-role invoice creation core.
 *
 * Server-only — imported transitively via `@/lib/supabase/server` (which
 * imports `next/headers` and is therefore refused by the client bundler).
 *
 * This module is intentionally NOT a `"use server"` file, so its exports
 * are plain server-only helpers, not server actions that the client could
 * invoke directly. Callers are responsible for their own authorization:
 *
 *   - `createInvoice` (lib/actions/invoices.ts) calls this after `requireAdmin()`.
 *   - `createInvoiceForWorkOrder` (lib/actions/invoices.ts) calls this after
 *     its own admin and linked-invoice checks.
 *
 * Phase 3 locked decisions: Stripe-hosted invoices; lazy-create the Stripe
 * customer on first invoice and stash on profile; mirror the Stripe state
 * onto a local `invoices` row; Stripe failure still inserts a local row
 * (NULL `stripe_invoice_id`) so the admin sees the attempt.
 */
import { createAdminClient } from "@/lib/supabase/server";
import { getOrCreateStripeCustomer, createHostedInvoice } from "@/lib/stripe";
import { sendEmail } from "@/lib/resend";
import { invoiceReadyToClient } from "@/lib/resend-templates";

export type InvoiceCreationResult =
  | {
      ok: true;
      data: {
        id: string;
        stripe_invoice_id: string | null;
        hosted_invoice_url: string | null;
        /** True when Stripe returned an invoice we already recorded locally. */
        reused?: true;
      };
    }
  // `localInvoiceId` is set only on a Stripe failure: the local row exists.
  | { ok: false; error: string; localInvoiceId?: string };

export interface CreateInvoiceForUserInput {
  user_id: string;
  /**
   * Optional. Work-order invoices may have no project yet — in that case the
   * row is owned via `invoices.user_id` (= the work order's `created_by`) so
   * RLS still lets the client see + pay it.
   */
  project_id?: string | null;
  amount_cents: number;
  currency: string;
  description?: string | null;
  work_order_id?: string;
}

/**
 * Audit actions that record a work order as billed. `invoice.create_stripe_failed`
 * is deliberately absent: it is an attempt, not a bill, so a retry after a
 * Stripe failure keeps the same idempotency key.
 */
export const BILLED_AUDIT_ACTIONS = [
  "invoice.create",
  "invoice.create_for_work_order",
  "invoice.link_failed"
] as const;

/** Audit action for a Stripe failure: an attempt (local unsent row), not a bill. */
export const STRIPE_FAILED_ACTION = "invoice.create_stripe_failed";

/**
 * Fixed refusal when an audited bill's invoice row no longer exists (e.g.
 * deleteProject cascades invoices). The newest bill cannot be determined, so
 * the re-bill is refused rather than keyed from an incomplete history.
 */
export const AUDITED_INVOICE_MISSING =
  "A billed invoice recorded for this work order no longer exists, so its billing history is incomplete. Re-billing is blocked: check the work order's invoices on /admin/invoices and the Stripe dashboard, void any open invoice there, then contact an engineer to repair the history.";

// PostgREST's default row cap: a read returning this many rows may be truncated.
const POSTGREST_MAX_ROWS = 1000;

const WORK_ORDER_HISTORY_READ_FAILED =
  "Unable to read the work order's billing history";

export const STRIPE_VOID_STEP =
  "void it in the Stripe dashboard (find that invoice on /admin/invoices; the row's Stripe link or dashboard link opens it)";

/**
 * Refusal for a work order whose linked (or audited) invoice is not void. One
 * message for one condition: shared by the admin actions' gate and this
 * helper's own re-check.
 */
export function alreadyInvoicedMessage(invoiceId: string): string {
  return `Invoice ${invoiceId} is already billed for this work order. To bill again, ${STRIPE_VOID_STEP}; once the webhook marks it void, this work order can be billed again.`;
}

/**
 * Stripe idempotency key for a work-order invoice. The first bill uses `v1`;
 * a re-bill after a void uses the replaced invoice's id so Stripe sees a new key.
 */
export function workOrderInvoiceIdempotencyKey(
  workOrderId: string,
  replacedInvoiceId: string | null
): string {
  return `work-order-invoice:${workOrderId}:${replacedInvoiceId ?? "v1"}`;
}

export async function createInvoiceForUser(
  input: CreateInvoiceForUserInput
): Promise<InvoiceCreationResult> {
  const admin = createAdminClient();

  // Resolve recipient (email is required for Stripe customer mapping).
  let recipientEmail: string | null = null;
  let recipientName: string | null = null;
  try {
    const { data: userRes } = await admin.auth.admin.getUserById(input.user_id);
    recipientEmail = userRes?.user?.email ?? null;
    recipientName =
      (userRes?.user?.user_metadata as { full_name?: string } | null)?.full_name ?? null;
  } catch (e) {
    return {
      ok: false,
      error: `unable to resolve user ${input.user_id}: ${e instanceof Error ? e.message : String(e)}`
    };
  }
  if (!recipientEmail) {
    return { ok: false, error: `user ${input.user_id} has no email on file` };
  }
  if (!recipientName) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", input.user_id)
      .single();
    recipientName = profile?.full_name ?? null;
  }

  // For a work-order invoice, read the work order's current invoice link
  // BEFORE any Stripe call. Callers check the linked invoice too, but those
  // checks can be stale under concurrent billing (another request may have
  // finished and back-linked a new invoice since), so this helper re-checks:
  // a linked invoice must be void, and it is then the invoice being replaced.
  // Fail closed: these errors deliberately do not start with "Stripe error:",
  // which callers read as "a local row exists".
  let replacedInvoiceId: string | null = null;
  let keyInvoiceId: string | null = null;
  let linkedCreatedAt: string | null = null;
  if (input.work_order_id) {
    const { data: wo, error: woErr } = await admin
      .from("work_orders")
      .select("invoice_id")
      .eq("id", input.work_order_id)
      .single();
    if (woErr || !wo) {
      return { ok: false, error: "Unable to read the work order's current invoice link" };
    }
    replacedInvoiceId = wo.invoice_id ?? null;
    if (replacedInvoiceId) {
      const { data: linked, error: linkedErr } = await admin
        .from("invoices")
        .select("status,created_at")
        .eq("id", replacedInvoiceId)
        .single();
      if (linkedErr || !linked) {
        return { ok: false, error: "Unable to read the work order's current invoice link" };
      }
      if (linked.status !== "void") {
        return { ok: false, error: alreadyInvoicedMessage(replacedInvoiceId) };
      }
      linkedCreatedAt = linked.created_at ?? null;
    }

    // The newest actual bill for this work order decides the key. Recency is
    // the INVOICE's created_at on every side, never an audit row's time (an
    // audit write is non-fatal and can be delayed, so audit order need not
    // match invoice order). Candidates: the linked invoice plus the invoices
    // behind the most recent audited bills. After an `invoice.link_failed` the
    // link is older than an audited invoice, so the audited one wins; a linked
    // invoice whose audit write failed or lagged is newer than an audited
    // one, so the link wins; a tie goes to the link. Every candidate must be
    // void. A re-bill therefore gets a fresh key (a reused key with a new
    // amount is rejected by Stripe), while a retry with nothing newly billed
    // keeps the same key; Stripe-failed attempts are not "billed".
    // No row limit: every billed audit for this work order is read, so an
    // older bill can never be missed. The set is bounded by the work order's
    // bill count (one row per bill, filtered by work_order_id), far below
    // PostgREST's default 1000-row cap; reaching the cap fails closed below.
    const { data: billed, error: billedErr } = await admin
      .from("admin_audit_log")
      .select("target_id")
      .in("action", [...BILLED_AUDIT_ACTIONS])
      .eq("data->>work_order_id", input.work_order_id)
      .order("created_at", { ascending: false });
    if (billedErr) return { ok: false, error: WORK_ORDER_HISTORY_READ_FAILED };
    const billedRows = billed ?? [];
    if (billedRows.length >= POSTGREST_MAX_ROWS) {
      return { ok: false, error: WORK_ORDER_HISTORY_READ_FAILED };
    }
    if (billedRows.some((r) => !r.target_id)) {
      return { ok: false, error: WORK_ORDER_HISTORY_READ_FAILED };
    }
    const auditedIds = [
      ...new Set(
        billedRows
          .map((r) => r.target_id)
          .filter((id): id is string => !!id && id !== replacedInvoiceId)
      )
    ];

    // Linked invoice first so a created_at tie keeps the link.
    const candidates: { id: string; createdAt: string | null }[] = replacedInvoiceId
      ? [{ id: replacedInvoiceId, createdAt: linkedCreatedAt }]
      : [];
    if (auditedIds.length) {
      const { data: audited, error: auditedErr } = await admin
        .from("invoices")
        .select("id,status,created_at")
        .in("id", auditedIds);
      if (auditedErr) return { ok: false, error: WORK_ORDER_HISTORY_READ_FAILED };
      // An audited invoice absent from the read was deleted (a project cascade
      // or any other delete); dropping it silently could hide the newest
      // bill, so refuse.
      const found = new Set((audited ?? []).map((inv) => inv.id));
      if (auditedIds.some((id) => !found.has(id))) {
        return { ok: false, error: AUDITED_INVOICE_MISSING };
      }
      for (const inv of audited ?? []) {
        if (inv.status !== "void") {
          return { ok: false, error: alreadyInvoicedMessage(inv.id) };
        }
        candidates.push({ id: inv.id, createdAt: inv.created_at ?? null });
      }
    }
    let newest: { id: string; at: number } | null = null;
    // A lone candidate needs no ordering (so no timestamp); two or more do.
    for (const c of candidates.length > 1 ? candidates : []) {
      const at = Date.parse(c.createdAt ?? "");
      if (Number.isNaN(at)) return { ok: false, error: WORK_ORDER_HISTORY_READ_FAILED };
      if (!newest || at > newest.at) newest = { id: c.id, at };
    }
    keyInvoiceId = candidates.length === 1 ? candidates[0].id : (newest?.id ?? null);
  }

  // Stripe-hosted invoice flow.
  let stripeInvoiceId: string | null = null;
  let hostedInvoiceUrl: string | null = null;
  let stripeError: string | null = null;
  try {
    const customerId = await getOrCreateStripeCustomer({
      supabaseUserId: input.user_id,
      email: recipientEmail,
      name: recipientName
    });
    const result = await createHostedInvoice({
      customerId,
      // Stripe retains keys for ~24h and rejects a reused key whose parameters
      // differ. The key includes the newest billed invoice (see above) so a
      // re-bill after a void (possibly with a new amount) gets a fresh key,
      // while a retry of the same attempt (nothing newly billed) reuses it. Durable
      // reservation is still required to protect retries after that window or
      // after local failures.
      idempotencyKey: input.work_order_id
        ? workOrderInvoiceIdempotencyKey(input.work_order_id, keyInvoiceId)
        : undefined,
      amountCents: input.amount_cents,
      currency: input.currency.toLowerCase(),
      description: input.description ?? undefined,
      metadata: {
        supabase_user_id: input.user_id,
        project_id: input.project_id ?? undefined,
        work_order_id: input.work_order_id
      }
    });
    stripeInvoiceId = result.id;
    hostedInvoiceUrl = result.hosted_invoice_url;
  } catch (e) {
    stripeError = e instanceof Error ? e.message : String(e);
    console.error("[createInvoiceForUser] Stripe failure:", stripeError);
  }

  // Defence in depth: Stripe's idempotency key returns the SAME invoice on a
  // repeat call for a work order. If that invoice is already recorded locally,
  // do not insert (or email) a second row; report the existing one.
  if (stripeInvoiceId && input.work_order_id) {
    const { data: existing, error: existingErr } = await admin
      .from("invoices")
      .select("id,hosted_invoice_url,status")
      .eq("stripe_invoice_id", stripeInvoiceId)
      .limit(10);
    if (existingErr) {
      return { ok: false, error: "Unable to check for an existing invoice record" };
    }
    const row = existing?.find((r) => r.status !== "void");
    if (!row && existing?.length) {
      return {
        ok: false,
        error:
          "Stripe returned a voided invoice for this work order; wait 24h, then try again"
      };
    }
    if (row) {
      return {
        ok: true,
        data: {
          id: row.id,
          stripe_invoice_id: stripeInvoiceId,
          hosted_invoice_url: row.hosted_invoice_url ?? hostedInvoiceUrl,
          reused: true
        }
      };
    }
  }

  // Persist local row regardless (NULL stripe_invoice_id is the visible
  // signal of a Stripe failure to the admin).
  //
  // `user_id` is ALWAYS populated so the new RLS branch (user_id = auth.uid())
  // makes the invoice visible to the client even when `project_id` is NULL.
  const invoiceRow = {
    project_id: input.project_id ?? null,
    user_id: input.user_id,
    amount_cents: input.amount_cents,
    currency: input.currency,
    status: "open" as const,
    stripe_invoice_id: stripeInvoiceId,
    hosted_invoice_url: hostedInvoiceUrl
  };
  const { data, error } = await admin
    .from("invoices")
    .insert(invoiceRow)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "insert failed" };
  }

  if (hostedInvoiceUrl) {
    try {
      const tpl = invoiceReadyToClient({
        invoice: { id: data.id, amount_cents: input.amount_cents, currency: input.currency },
        hostedUrl: hostedInvoiceUrl,
        description: input.description ?? null
      });
      await sendEmail({ to: recipientEmail, subject: tpl.subject, text: tpl.text, html: tpl.html });
    } catch (e) {
      console.warn("[createInvoiceForUser] invoice-ready email failed (non-fatal):", e);
    }
  }

  if (stripeError) {
    return { ok: false, error: `Stripe error: ${stripeError}`, localInvoiceId: data.id };
  }

  return {
    ok: true,
    data: {
      id: data.id,
      stripe_invoice_id: stripeInvoiceId,
      hosted_invoice_url: hostedInvoiceUrl
    }
  };
}
