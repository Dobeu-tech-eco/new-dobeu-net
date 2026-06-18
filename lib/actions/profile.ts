"use server";
/**
 * Portal profile server action (Phase 2).
 *
 * Per PRODUCTION-PLAN §5 Phase 2: portal/settings becomes a write surface.
 * Client action -> cookie-bound `createClient()` so RLS enforces
 * `id = auth.uid()` on the profiles row.
 *
 * `phone` is accepted by the action shape per the parent prompt but the
 * `profiles` table does not have a `phone` column today. We deliberately do
 * NOT silently drop it -- it's returned in the action result as
 * `unstored_phone` so callers can detect the gap, and a follow-up migration
 * can add the column without changing this action's signature.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, AuthError } from "@/lib/actions/auth";

const updateInput = z.object({
  full_name: z.string().trim().min(1, "name required").max(160).optional().nullable(),
  company: z.string().trim().max(160).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable()
});

export type UpdateProfileInput = z.infer<typeof updateInput>;
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function updateProfile(
  raw: unknown
): Promise<ActionResult<{ id: string; unstored_phone: string | null }>> {
  const parsed = updateInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { full_name, company, phone } = parsed.data;

  let user, supabase;
  try {
    ({ user, supabase } = await requireUser());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  const patch: { full_name?: string | null; company?: string | null } = {};
  if (full_name !== undefined) patch.full_name = full_name;
  if (company !== undefined) patch.company = company;

  if (Object.keys(patch).length === 0 && phone === undefined) {
    return { ok: false, error: "no fields to update" };
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/portal/settings");
  return { ok: true, data: { id: user.id, unstored_phone: phone ?? null } };
}
