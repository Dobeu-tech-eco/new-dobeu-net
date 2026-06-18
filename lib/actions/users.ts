"use server";
/**
 * User admin server actions (Phase 2+).
 *
 * Mirrors lib/actions/projects.ts: every action requires `requireAdmin()`
 * (ADMIN_EMAILS gate + service-role client). Callers live under app/admin/*,
 * which is already gated at the layout level.
 *
 *   - inviteUser:  sends a Supabase invite (auth.admin.inviteUserByEmail). The
 *     `handle_new_user` trigger auto-creates the `profiles` row on accept.
 *   - updateUser:  patches `full_name` / `company` on an existing profile.
 *
 * Invite delivery depends on Supabase SMTP being configured (see recent auth
 * commits / docs on Supabase SMTP limits). If SMTP is unavailable the invite
 * insert still succeeds server-side but no email is delivered — the operator
 * must fall back to a manual magic-link / password reset for that address.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, AuthError } from "@/lib/actions/auth";

const uuid = z.string().uuid("invalid id");

const inviteInput = z.object({
  email: z.string().trim().email("invalid email").max(254),
  full_name: z.string().trim().min(1).max(160).optional().nullable()
});

const updateInput = z.object({
  id: uuid,
  full_name: z.string().trim().min(1, "name required").max(160).optional().nullable(),
  company: z.string().trim().max(160).optional().nullable()
});

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Invite a new user by email. Uses `auth.admin.inviteUserByEmail`, which emails
 * a sign-up link and creates the auth user (profile row follows via trigger).
 */
export async function inviteUser(
  raw: unknown
): Promise<ActionResult<{ id: string; email: string }>> {
  const parsed = inviteInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { email, full_name } = parsed.data;

  let admin;
  try {
    ({ admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: full_name ? { full_name } : undefined
  });

  if (error || !data?.user) {
    return { ok: false, error: error?.message ?? "invite failed" };
  }

  revalidatePath("/admin/users");
  return { ok: true, data: { id: data.user.id, email } };
}

/**
 * Patch an existing profile's `full_name` / `company`.
 */
export async function updateUser(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { id, ...patch } = parsed.data;

  // Reject no-op updates (Zod allows all-optional inputs).
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "no fields to update" };
  }

  let admin;
  try {
    ({ admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  const { error } = await admin.from("profiles").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  return { ok: true, data: { id } };
}
