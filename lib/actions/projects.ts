"use server";
/**
 * Project admin server actions (Phase 2).
 *
 * Per PRODUCTION-PLAN §5 Phase 2: admin CRUD via server actions.
 * All four actions require `requireAdmin()` -- callers must already be inside
 * `app/admin/*` (gated at the layout level) AND pass the env-driven email check.
 *
 * Cascade: `project_files.project_id` has `on delete cascade` (see initial
 * schema migration), so `deleteProject` automatically removes file rows.
 * Storage objects under `project-files/` are NOT auto-deleted -- a Phase 3+
 * cleanup job will reap orphans (low risk for now: storage is private, the
 * objects just become unreferenceable until then).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, AuthError } from "@/lib/actions/auth";

const uuid = z.string().uuid("invalid id");

const projectStatus = z.enum(["proposed", "active", "delivered", "closed"]);

const createInput = z.object({
  owner_user_id: uuid,
  company_id: uuid.optional().nullable(),
  title: z.string().trim().min(2, "title too short").max(160, "title too long"),
  description: z.string().trim().max(8000).optional().nullable(),
  status: projectStatus.optional().default("proposed"),
  total_cents: z.number().int().nonnegative().optional().default(0),
});

const updateInput = z.object({
  id: uuid,
  company_id: uuid.optional().nullable(),
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(8000).optional().nullable(),
  status: projectStatus.optional(),
  total_cents: z.number().int().nonnegative().optional(),
});

const deleteInput = z.object({ id: uuid });

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string };

export async function createProject(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const input = parsed.data;

  let admin;
  try {
    ({ admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  if (input.company_id) {
    const { data: company, error } = await admin
      .from("companies")
      .select("id,status")
      .eq("id", input.company_id)
      .single();
    if (error || !company) return { ok: false, error: "Company not found" };
    if (company.status !== "active") {
      return { ok: false, error: "Company must be active" };
    }
  }

  const { data, error } = await admin
    .from("projects")
    .insert({
      owner_user_id: input.owner_user_id,
      company_id: input.company_id ?? null,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      total_cents: input.total_cents,
    })
    .select("id")
    .single();

  if (error || !data)
    return { ok: false, error: error?.message ?? "insert failed" };

  revalidatePath("/admin/projects");
  revalidatePath("/portal/projects");
  if (input.company_id) revalidatePath(`/admin/companies/${input.company_id}`);
  return { ok: true, data: { id: data.id } };
}

export async function updateProject(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
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

  const { data: existing, error: readError } = await admin
    .from("projects")
    .select("company_id")
    .eq("id", id)
    .single();
  if (readError || !existing) return { ok: false, error: "Project not found" };

  if (patch.company_id) {
    const { data: company, error } = await admin
      .from("companies")
      .select("id,status")
      .eq("id", patch.company_id)
      .single();
    if (error || !company) return { ok: false, error: "Company not found" };
    if (company.status !== "active") {
      return { ok: false, error: "Company must be active" };
    }
  }

  const { error } = await admin.from("projects").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${id}`);
  revalidatePath("/portal/projects");
  revalidatePath(`/portal/projects/${id}`);
  for (const companyId of new Set([existing.company_id, patch.company_id])) {
    if (companyId) revalidatePath(`/admin/companies/${companyId}`);
  }
  return { ok: true, data: { id } };
}

export async function deleteProject(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const { id } = parsed.data;

  let admin;
  try {
    ({ admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  const { error } = await admin.from("projects").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/projects");
  revalidatePath("/portal/projects");
  return { ok: true, data: { id } };
}
