"use server";
/**
 * Portal profile server action (Phase 2).
 *
 * Per PRODUCTION-PLAN §5 Phase 2: portal/settings is a write surface.
 * Client action -> cookie-bound `createClient()` so RLS enforces
 * `id = auth.uid()` on the profiles row.
 *
 * `phone` and `notify_email` are now backed by columns added in
 * `supabase/migrations/20260618000100_profiles_prefs_phone.sql` and are
 * persisted directly. (Previously `phone` was dropped on the floor and
 * surfaced as `unstored_phone`; that escape-hatch is gone now that the
 * column exists.)
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, AuthError } from "@/lib/actions/auth";

const updateInput = z.object({
  full_name: z.string().trim().min(1, "name required").max(160).optional().nullable(),
  company: z.string().trim().max(160).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  notify_email: z.boolean().optional()
});

export type UpdateProfileInput = z.infer<typeof updateInput>;
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function updateProfile(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { full_name, company, phone, notify_email } = parsed.data;

  let user, supabase;
  try {
    ({ user, supabase } = await requireUser());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  // `!== undefined` (not truthiness) so `notify_email: false` and cleared
  // (null) string fields are all persisted.
  const patch: {
    full_name?: string | null;
    company?: string | null;
    phone?: string | null;
    notify_email?: boolean;
  } = {};
  if (full_name !== undefined) patch.full_name = full_name;
  if (company !== undefined) patch.company = company;
  if (phone !== undefined) patch.phone = phone;
  if (notify_email !== undefined) patch.notify_email = notify_email;

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "no fields to update" };
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/portal/settings");
  return { ok: true, data: { id: user.id } };
}
