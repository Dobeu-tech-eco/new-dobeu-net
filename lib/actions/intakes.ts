"use server";

/**
 * Admin-only review actions for Typeform budget intakes.
 *
 * These actions deliberately stop at review state. They do not calculate a
 * price, create a quote, process a lead, or notify any external system.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthError, requireAdminAal2 } from "@/lib/actions/auth";

const id = z.string().uuid("invalid id");
const noteText = z.string().trim().max(4000, "notes too long").optional();
const notes = noteText.transform((value) => (value === "" ? null : value));

const actionInput = z
  .object({
    id,
    notes: noteText,
  })
  .strict();

const statusInput = actionInput
  .extend({
    notes,
    status: z.enum(["reviewed", "archived"]),
  })
  .strict();

type IntakeStatus = z.infer<typeof statusInput>["status"];

export type IntakeActionResult =
  | { ok: true; data: { id: string; status: IntakeStatus } }
  | { ok: false; error: string };

function validationError(error: z.ZodError): IntakeActionResult {
  return {
    ok: false,
    error: error.issues.map((issue) => issue.message).join("; "),
  };
}

/**
 * Apply one of the two permitted review transitions.
 *
 * Exported so the status allowlist is directly testable. Callers should
 * normally use `markIntakeReviewed` or `archiveIntake` below.
 */
export async function updateIntakeStatus(
  raw: unknown,
): Promise<IntakeActionResult> {
  const parsed = statusInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);

  const { id: intakeId, notes: reviewNotes, status } = parsed.data;

  let user, admin;
  try {
    ({ user, admin } = await requireAdminAal2());
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.code };
    throw error;
  }

  const now = new Date().toISOString();
  const changes = {
    status,
    ...(reviewNotes !== undefined ? { review_notes: reviewNotes } : {}),
    reviewed_at: now,
    reviewed_by: user.id,
  };

  const { data: updated, error } = await admin
    .from("typeform_budget_intakes")
    .update(changes)
    .eq("id", intakeId)
    .in("status", ["new", "reviewed"])
    .select("id,status")
    .maybeSingle();

  if (error) {
    console.error("[intakes] failed to update intake:", error.code);
    return { ok: false, error: "intake_update_failed" };
  }
  if (!updated) {
    return { ok: false, error: "intake_not_found_or_invalid_transition" };
  }

  revalidatePath("/admin/intakes");
  revalidatePath(`/admin/intakes/${intakeId}`);

  return { ok: true, data: { id: intakeId, status } };
}

export async function markIntakeReviewed(
  raw: unknown,
): Promise<IntakeActionResult> {
  const parsed = actionInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  return updateIntakeStatus({ ...parsed.data, status: "reviewed" });
}

export async function archiveIntake(raw: unknown): Promise<IntakeActionResult> {
  const parsed = actionInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  return updateIntakeStatus({ ...parsed.data, status: "archived" });
}
