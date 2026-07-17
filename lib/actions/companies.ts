"use server";
/**
 * Super-admin company server actions (Phase 3 — multi-tenant layer).
 *
 * Every action requires `requireAdmin()` (ADMIN_EMAILS gate + service-role
 * client). Callers live under `app/admin/companies/*`, which is already gated
 * at the admin layout level. Mirrors `lib/actions/projects.ts`:
 *   - discriminated `{ ok: true, data } | { ok: false, error }` returns
 *   - zod-validated inputs
 *   - service-role mutations (admin reads/writes bypass RLS by convention)
 *
 * Audit trail: EVERY action records an `admin_audit_log` row (actor, action,
 * target_type 'company', target_id, jsonb data). The audit write is best-effort
 * (non-fatal) so an audit-table hiccup never rolls back a completed provisioning
 * action — mirrors the "side effects never break the primary op" discipline in
 * `lib/actions/work-orders.ts`.
 *
 * `provisionCompanyAdmin` invites the target user (`inviteUserByEmail`); if the
 * address is already registered it resolves the existing user via `listUsers`
 * and grants `company_admin` with status 'active' instead of 're-inviting'.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, AuthError, type DBClient } from "@/lib/actions/auth";
import type { Json } from "@/lib/database.types";

const uuid = z.string().uuid("invalid id");

const createInput = z.object({
  name: z.string().trim().min(2, "name too short").max(160, "name too long")
});

const idInput = z.object({ id: uuid });

const provisionInput = z.object({
  companyId: uuid,
  email: z.string().trim().email("invalid email").max(254)
});

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Best-effort audit write. A failure is logged (non-fatal) rather than
 * surfaced, so the primary action's success is never undone by an audit hiccup.
 */
async function writeAudit(
  admin: DBClient,
  actorUserId: string,
  action: string,
  targetId: string | null,
  data: Json
): Promise<void> {
  const { error } = await admin.from("admin_audit_log").insert({
    actor_user_id: actorUserId,
    action,
    target_type: "company",
    target_id: targetId,
    data
  });
  if (error) {
    console.warn("[companies] audit log insert failed (non-fatal):", error.message);
  }
}

export async function createCompany(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { name } = parsed.data;

  let user, admin;
  try {
    ({ user, admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  const { data, error } = await admin
    .from("companies")
    .insert({ name, created_by: user.id })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };

  await writeAudit(admin, user.id, "company.create", data.id, { name });

  revalidatePath("/admin/companies");
  return { ok: true, data: { id: data.id } };
}

/**
 * Flip a company's `status` and record the change. Shared by
 * `suspendCompany` / `reactivateCompany`.
 */
async function setCompanyStatus(
  raw: unknown,
  status: "active" | "suspended",
  action: string
): Promise<ActionResult<{ id: string }>> {
  const parsed = idInput.safeParse(raw);
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

  const { error } = await admin.from("companies").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await writeAudit(admin, user.id, action, id, { status });

  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${id}`);
  return { ok: true, data: { id } };
}

export async function suspendCompany(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  return setCompanyStatus(raw, "suspended", "company.suspend");
}

export async function reactivateCompany(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  return setCompanyStatus(raw, "active", "company.reactivate");
}

/**
 * Detect Supabase's "already registered" signal from an invite error, across
 * the shapes it has shipped (message text, `email_exists` code, 422 status).
 */
function isAlreadyRegistered(error: {
  message?: string;
  code?: string;
  status?: number;
}): boolean {
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("already registered") ||
    msg.includes("already been registered") ||
    error.code === "email_exists" ||
    error.status === 422
  );
}

/**
 * Resolve an existing auth user by email via paginated `listUsers`. Returns
 * null (never throws) so the caller can surface a clean error.
 */
async function findUserByEmail(
  admin: DBClient,
  email: string
): Promise<{ id: string } | null> {
  const target = email.toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return null;
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return { id: match.id };
    if (users.length < perPage) break;
  }
  return null;
}

/**
 * Invite (or link an existing) user as this company's admin.
 *
 * New address  → `inviteUserByEmail` sends a sign-up link; membership lands
 *                as status 'invited'.
 * Known address → resolved via `listUsers`; membership lands as 'active'.
 *
 * The membership is check-then-write (the `unique (company_id, user_id)`
 * constraint is the ultimate guard): an existing row is promoted to
 * `company_admin`; otherwise a new row is inserted.
 */
export async function provisionCompanyAdmin(
  raw: unknown
): Promise<ActionResult<{ userId: string; status: "invited" | "active" }>> {
  const parsed = provisionInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { companyId, email } = parsed.data;

  let user, admin;
  try {
    ({ user, admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  // Confirm the company exists first — a clean error beats an FK failure.
  const { data: company, error: companyErr } = await admin
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .single();
  if (companyErr || !company) return { ok: false, error: "company not found" };

  // Invite the user; fall back to lookup if already registered.
  let userId: string;
  let memberStatus: "invited" | "active";

  const { data: invited, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(email);

  if (invited?.user) {
    userId = invited.user.id;
    memberStatus = "invited";
  } else if (inviteErr && isAlreadyRegistered(inviteErr)) {
    const existing = await findUserByEmail(admin, email);
    if (!existing) {
      return { ok: false, error: "user already registered but could not be resolved" };
    }
    userId = existing.id;
    memberStatus = "active";
  } else {
    return { ok: false, error: inviteErr?.message ?? "invite failed" };
  }

  // Promote an existing membership, or insert a fresh company_admin row.
  const { data: existingMember } = await admin
    .from("company_members")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .single();

  if (existingMember) {
    const { error } = await admin
      .from("company_members")
      .update({ role: "company_admin", status: memberStatus, invited_by: user.id })
      .eq("id", existingMember.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin.from("company_members").insert({
      company_id: companyId,
      user_id: userId,
      role: "company_admin",
      status: memberStatus,
      invited_by: user.id
    });
    if (error) return { ok: false, error: error.message };
  }

  await writeAudit(admin, user.id, "company.provision_admin", companyId, {
    email,
    user_id: userId,
    status: memberStatus
  });

  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${companyId}`);
  return { ok: true, data: { userId, status: memberStatus } };
}
