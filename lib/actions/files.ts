"use server";
/**
 * Admin deliverable-upload server actions (Phase 2+).
 *
 * Bytes must NOT flow through a server action: Next.js caps action request
 * bodies at ~1MB, far below the 25MB deliverable ceiling. The flow is:
 *
 *   1. `createDeliverableUploadUrl({ project_id, filename, size_bytes, mime })` —
 *      admin mints a signed upload URL for the `project-files` bucket
 *      (service-role client). Size (<= 25 MB) and MIME (allowlist) are rejected
 *      BEFORE a URL is minted; the bucket enforces the same limits in storage
 *      (see 20261022000200_storage_deliverable_size_limit.sql).
 *   2. The BROWSER PUTs the bytes directly to storage via `uploadToSignedUrl`
 *      (see components/admin/DeliverableUpload.tsx). Size + MIME are pre-checked
 *      client-side there.
 *   3. `recordDeliverable(...)` — admin inserts the `project_files` row with
 *      `uploaded_by` = admin uuid. MIME is re-validated server-side against the
 *      allowlist; size is the client-reported value (best-effort — the action
 *      never sees the bytes, so this is not a hard server-side guarantee).
 *
 * Both actions require `requireAdminAal2()`.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminAal2, AuthError } from "@/lib/actions/auth";
import {
  MAX_DELIVERABLE_BYTES,
  ALLOWED_DELIVERABLE_MIME,
  OBJECT_NAME_CHARSET,
  filenameError,
  tooLargeMessage
} from "@/lib/deliverable-limits";

const BUCKET = "project-files";

const uuid = z.string().uuid("invalid id");

const mimeEnum = z.enum(ALLOWED_DELIVERABLE_MIME, {
  errorMap: () => ({ message: "Unsupported file type." })
});

const createUrlInput = z
  .object({
    project_id: uuid,
    filename: z.string().trim(),
    size_bytes: z.number().int().positive("size_bytes required"),
    mime: mimeEnum
  })
  .superRefine((v, ctx) => {
    const msg = filenameError(v.filename, v.mime);
    if (msg) ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: ["filename"] });
  });

const recordInput = z
  .object({
    project_id: uuid,
    storage_path: z.string().trim().min(1).max(400),
    filename: z.string().trim(),
    mime: mimeEnum,
    size_bytes: z.number().int().positive().max(MAX_DELIVERABLE_BYTES, "file too large (25MB max)")
  })
  .superRefine((v, ctx) => {
    const msg = filenameError(v.filename, v.mime);
    if (msg) ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: ["filename"] });
  });

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Build a collision-resistant storage path: `<projectId>/<ts>-<filename>`. */
function buildStoragePath(projectId: string, filename: string): string {
  const stamp = Date.now().toString(36);
  return `${projectId}/${stamp}-${filename}`;
}

/**
 * Mint a signed upload URL for a deliverable. The browser uses the returned
 * `token` + `path` with `uploadToSignedUrl` to PUT the bytes directly.
 */
export async function createDeliverableUploadUrl(
  raw: unknown
): Promise<ActionResult<{ path: string; token: string }>> {
  const parsed = createUrlInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { project_id, filename, size_bytes } = parsed.data;

  if (size_bytes > MAX_DELIVERABLE_BYTES) {
    return { ok: false, error: tooLargeMessage(size_bytes) };
  }

  let admin;
  try {
    ({ admin } = await requireAdminAal2());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  // Confirm the project exists before issuing a URL (avoids orphan uploads).
  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id")
    .eq("id", project_id)
    .single();
  if (projectError || !project) {
    return { ok: false, error: projectError?.message ?? "project not found" };
  }

  const path = buildStoragePath(project_id, filename);
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "could not create upload url" };
  }

  return { ok: true, data: { path: data.path, token: data.token } };
}

/**
 * Insert the `project_files` row after the browser has uploaded the bytes.
 */
export async function recordDeliverable(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = recordInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { project_id, storage_path, filename } = parsed.data;

  let admin, user;
  try {
    ({ admin, user } = await requireAdminAal2());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  // The path must live under this project's prefix (mirrors work-orders) and
  // the object name must be a single safe segment.
  const prefix = `${project_id}/`;
  const objectName = storage_path.startsWith(prefix) ? storage_path.slice(prefix.length) : "";
  if (!objectName || !OBJECT_NAME_CHARSET.test(objectName) || objectName.includes("..")) {
    return { ok: false, error: "storage_path outside project namespace" };
  }

  // Never trust client-declared size/mime: read the real object metadata.
  const bucket = admin.storage.from(BUCKET);
  const { data: info, error: infoError } = await bucket.info(storage_path);
  if (infoError || !info) {
    return { ok: false, error: "uploaded object not found" };
  }
  const realSize = info.size;
  const realMime = (info.contentType ?? "").split(";")[0].trim().toLowerCase();
  const reject = async (message: string): Promise<ActionResult<{ id: string }>> => {
    await bucket.remove([storage_path]);
    return { ok: false, error: message };
  };
  if (typeof realSize !== "number" || !Number.isFinite(realSize) || realSize <= 0) {
    return reject("uploaded object has no size");
  }
  if (realSize > MAX_DELIVERABLE_BYTES) return reject(tooLargeMessage(realSize));
  if (!(ALLOWED_DELIVERABLE_MIME as readonly string[]).includes(realMime)) {
    return reject("Unsupported file type.");
  }
  const realMsg = filenameError(filename, realMime);
  if (realMsg) return reject(realMsg);

  const { data, error } = await admin
    .from("project_files")
    .insert({
      project_id,
      storage_path,
      filename,
      mime: realMime,
      size_bytes: realSize,
      uploaded_by: user.id
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };

  revalidatePath(`/admin/projects/${project_id}`);
  revalidatePath(`/portal/projects/${project_id}`);
  return { ok: true, data: { id: data.id } };
}
