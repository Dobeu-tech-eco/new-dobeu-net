"use server";
/**
 * Invoice admin server actions (Phase 3).
 *
 * Both `createInvoice` and `markInvoicePaidManually` are admin-gated. The
 * actual Stripe-touching code lives in `@/lib/invoice-creation` so that
 * `acceptWorkOrderQuote` (a client-initiated action) can reuse the same
 * core path without dragging the admin guard along.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, AuthError } from "@/lib/actions/auth";
import { writeAdminAudit } from "@/lib/admin-audit";
import {
  createInvoiceForUser,
  type InvoiceCreationResult
} from "@/lib/invoice-creation";

const uuid = z.guid("invalid id");
const positiveInt = z
  .number()
  .int("must be an integer")
  .positive("must be > 0")
  .max(1_000_000_000, "absurdly large");

const createInput = z.object({
  user_id: uuid,
  // Optional: work-order invoices may have no project yet. Ownership for those
  // rows is carried by `user_id` (see lib/invoice-creation.ts + RLS).
  project_id: uuid.optional().nullable(),
  amount_cents: positiveInt,
  currency: z.string().min(3).max(3).optional().default("USD"),
  description: z.string().trim().max(2000).optional().nullable(),
  work_order_id: uuid.optional()
});

// Window in which an unsent (Stripe-failed) invoice blocks an identical one.
// (`draft` is not in the invoices.status enum, so only `open` rows can exist.)
const UNSENT_DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

const createForWorkOrderInput = z.object({ work_order_id: uuid });

const markPaidInput = z.object({ id: uuid });

/**
 * `linkFailed` is set when the invoice exists but could not be back-linked onto
 * its work order; callers must surface it (the invoice is NOT rolled back).
 */
export type CreateInvoiceResult =
  | Extract<InvoiceCreationResult, { ok: false }>
  | {
      ok: true;
      data: Extract<InvoiceCreationResult, { ok: true }>["data"] & {
        linkFailed?: true;
      };
    };

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function revalidateInvoicePaths() {
  revalidatePath("/admin/invoices");
  revalidatePath("/portal/invoices");
  revalidatePath("/admin/tickets");
  revalidatePath("/portal/tickets");
}

export async function createInvoice(raw: unknown): Promise<CreateInvoiceResult> {
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const input = parsed.data;

  let user, admin;
  try {
    ({ user, admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  // Server-side picker validation (the dialog only filters client-side): a
  // given project must belong to the recipient directly, or the recipient
  // must be an active member of the project's company.
  if (input.project_id) {
    const { data: project, error: projectErr } = await admin
      .from("projects")
      .select("owner_user_id,company_id")
      .eq("id", input.project_id)
      .single();
    if (projectErr || !project)
      return { ok: false, error: projectErr?.message ?? "Project not found" };
    if (project.owner_user_id !== input.user_id) {
      if (!project.company_id)
        return { ok: false, error: "Project must belong to the recipient" };
      const { data: membership, error: memberErr } = await admin
        .from("company_members")
        .select("id")
        .eq("company_id", project.company_id)
        .eq("user_id", input.user_id)
        .eq("status", "active")
        .single();
      if (memberErr || !membership)
        return { ok: false, error: "Project must belong to the recipient" };
    }
  }

  // Mirror the `createInvoiceForWorkOrder` preconditions when a work order is
  // linked. We deliberately do NOT delegate to that action: it bills the work
  // order's quoted amount with its own description, which would discard the
  // admin-entered amount/description/project. Instead we validate the same way
  // and perform the same conditional back-link below.
  if (input.work_order_id) {
    const { data: wo, error: woErr } = await admin
      .from("work_orders")
      .select("id,created_by,status,invoice_id")
      .eq("id", input.work_order_id)
      .single();
    if (woErr || !wo)
      return { ok: false, error: woErr?.message ?? "work order not found" };
    if (wo.created_by !== input.user_id)
      return { ok: false, error: "Work order does not belong to the recipient" };
    if (wo.invoice_id) {
      return { ok: false, error: "work order already has an invoice" };
    }
    if (wo.status !== "accepted") {
      return { ok: false, error: `can only invoice an accepted work order (status="${wo.status}")` };
    }
  }

  // Server-side duplicate guard, independent of any client state: a recent
  // unsent invoice (Stripe failed, so no stripe_invoice_id) for the same client
  // and amount blocks a retry that would double-bill once Stripe recovers.
  const cutoff = Date.now() - UNSENT_DUPLICATE_WINDOW_MS;
  const { data: unsent, error: unsentErr } = await admin
    .from("invoices")
    .select("id")
    .eq("user_id", input.user_id)
    .eq("amount_cents", input.amount_cents)
    .is("stripe_invoice_id", null)
    .in("status", ["open"])
    .gte("created_at", new Date(cutoff).toISOString())
    .limit(1);
  if (unsentErr) return { ok: false, error: "Unable to check for duplicate invoices" };
  if (unsent?.length) {
    return {
      ok: false,
      error:
        "An unsent invoice for this client and amount already exists from the last 24 hours (Stripe failed). Check the Stripe configuration, then void that invoice in Supabase (status = void) before creating another."
    };
  }

  const result = await createInvoiceForUser({
    user_id: input.user_id,
    project_id: input.project_id ?? null,
    amount_cents: input.amount_cents,
    currency: input.currency,
    description: input.description ?? null,
    work_order_id: input.work_order_id
  });

  if (!result.ok) {
    // A "Stripe error:" means the local invoice row was ALREADY inserted (see
    // lib/invoice-creation.ts), so the write still gets an audit trail
    // pointing at that row. Error text stays out of `data`.
    if (result.error.startsWith("Stripe error:")) {
      await writeAdminAudit(admin, {
        actorUserId: user.id,
        action: "invoice.create_stripe_failed",
        targetType: "invoice",
        targetId: result.localInvoiceId ?? null,
        data: { amount_cents: input.amount_cents, stripe_failed: true },
        logScope: "invoices",
      });
    }
    revalidateInvoicePaths();
    return result;
  }

  // Back-link the invoice onto the work order (service-role bypasses RLS).
  // The conditional write keeps a concurrent billing of the same work order
  // from silently overwriting the first link.
  // A zero-row match (someone linked it first) is a failure too, but the
  // invoice exists, so it is flagged instead of failing the action.
  let linkFailed = false;
  if (input.work_order_id) {
    const { data: linked, error: linkErr } = await admin
      .from("work_orders")
      .update({ invoice_id: result.data.id })
      .eq("id", input.work_order_id)
      .is("invoice_id", null)
      .select("id");
    if (linkErr || !linked?.length) {
      linkFailed = true;
      console.error(
        "[createInvoice] invoice created but back-link failed:",
        linkErr?.message ?? "no work order row matched"
      );
      await writeAdminAudit(admin, {
        actorUserId: user.id,
        action: "invoice.link_failed",
        targetType: "invoice",
        targetId: result.data.id,
        data: { work_order_id: input.work_order_id },
        logScope: "invoices",
      });
    }
  }

  await writeAdminAudit(admin, {
    actorUserId: user.id,
    action: "invoice.create",
    targetType: "invoice",
    targetId: result.data.id,
    data: {
      user_id: input.user_id,
      project_id: input.project_id ?? null,
      amount_cents: input.amount_cents,
      work_order_id: input.work_order_id ?? null,
    },
    logScope: "invoices",
  });

  revalidateInvoicePaths();
  if (linkFailed) return { ok: true, data: { ...result.data, linkFailed: true } };
  return result;
}

/**
 * Admin "Create Stripe Invoice" path for an accepted work order.
 *
 * This is the locked Stripe model: the client accepts a quote (which only
 * flips status to `accepted`), then the ADMIN explicitly issues the invoice
 * from /admin/tickets/[id]. Reads the work order via service-role, validates
 * it's `accepted` and not already invoiced, creates the invoice owned by the
 * work order's `created_by` (so the client can see + pay it even with no
 * project), and back-links `work_orders.invoice_id`.
 */
export async function createInvoiceForWorkOrder(
  raw: unknown
): Promise<InvoiceCreationResult> {
  const parsed = createForWorkOrderInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { work_order_id } = parsed.data;

  let user, admin;
  try {
    ({ user, admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  const { data: wo, error: readErr } = await admin
    .from("work_orders")
    .select("id,created_by,status,project_id,quoted_amount_cents,title,invoice_id")
    .eq("id", work_order_id)
    .single();

  if (readErr || !wo) return { ok: false, error: readErr?.message ?? "work order not found" };
  if (wo.invoice_id) {
    return { ok: false, error: "work order already has an invoice" };
  }
  if (wo.status !== "accepted") {
    return { ok: false, error: `can only invoice an accepted work order (status="${wo.status}")` };
  }
  if (!wo.quoted_amount_cents || wo.quoted_amount_cents <= 0) {
    return { ok: false, error: "work order has no quote amount" };
  }

  const result = await createInvoiceForUser({
    user_id: wo.created_by,
    project_id: wo.project_id ?? null,
    amount_cents: wo.quoted_amount_cents,
    currency: "USD",
    description: `Work order: ${wo.title}`,
    work_order_id: wo.id
  });

  // Back-link the invoice onto the work order (service-role bypasses RLS).
  if (result.ok) {
    const { error: linkErr } = await admin
      .from("work_orders")
      .update({ invoice_id: result.data.id })
      .eq("id", wo.id);
    if (linkErr) {
      console.error(
        "[createInvoiceForWorkOrder] invoice created but back-link failed:",
        linkErr.message
      );
    }
    await writeAdminAudit(admin, {
      actorUserId: user.id,
      action: "invoice.create_for_work_order",
      targetType: "invoice",
      targetId: result.data.id,
      data: {
        work_order_id: wo.id,
        user_id: wo.created_by,
        amount_cents: wo.quoted_amount_cents,
      },
      logScope: "invoices",
    });
  }

  revalidatePath("/admin/invoices");
  revalidatePath("/portal/invoices");
  revalidatePath("/admin/tickets");
  revalidatePath("/portal/tickets");
  revalidatePath(`/admin/tickets/${work_order_id}`);
  revalidatePath(`/portal/tickets/${work_order_id}`);
  return result;
}

export async function markInvoicePaidManually(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = markPaidInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { id } = parsed.data;

  let user, admin;
  try {
    ({ user, admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  // Guard in the action (not only by hiding the button): paid and void
  // invoices are terminal and must never be re-marked.
  const { data: existing, error: readErr } = await admin
    .from("invoices")
    .select("status")
    .eq("id", id)
    .single();

  if (readErr || !existing)
    return { ok: false, error: readErr?.message ?? "invoice not found" };
  if (existing.status === "paid")
    return { ok: false, error: "invoice already paid" };
  if (existing.status === "void") return { ok: false, error: "invoice is void" };
  const previousStatus = existing.status;

  // Conditional update: only open/overdue rows flip. A concurrent transition
  // matches zero rows, which surfaces as an empty rowset (conflict), not success.
  const { data: updated, error } = await admin
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["open", "overdue"])
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!updated?.length)
    return { ok: false, error: "invoice is no longer payable" };

  await writeAdminAudit(admin, {
    actorUserId: user.id,
    action: "invoice.mark_paid_manual",
    targetType: "invoice",
    targetId: id,
    data: { previous_status: previousStatus, status: "paid" },
    logScope: "invoices",
  });

  revalidatePath("/admin/invoices");
  revalidatePath("/portal/invoices");
  return { ok: true, data: { id } };
}
