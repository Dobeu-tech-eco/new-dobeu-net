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
 *      (see components/admin/DeliverableUpload.tsx). Size + type are pre-checked
 *      client-side there.
 *   3. `recordDeliverable(...)` — admin inserts the `project_files` row with
 *      `uploaded_by` = admin uuid. The action never sees the bytes, so it reads
 *      the real object metadata from storage and records THAT size and MIME;
 *      client-declared values are not trusted. The canonical MIME is derived
 *      from the object key's extension (EXTENSION_MIME), not from the browser.
 *
 * Object keys are server-generated and unique:
 * `<project_id>/<uuid>-<url-safe name>`. The display filename (spaces allowed)
 * is stored separately in `project_files.filename`.
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
  canonicalMimeForName,
  keySafeName,
  filenameError,
  tooLargeMessage
} from "@/lib/deliverable-limits";

const BUCKET = "project-files";

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = "23505";

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

const recordInput = z.object({
  project_id: uuid,
  storage_path: z.string().trim().min(1).max(400),
  filename: z.string().trim(),
  // Optional and advisory: the canonical MIME is derived from the key.
  mime: mimeEnum.optional(),
  size_bytes: z.number().int().positive().max(MAX_DELIVERABLE_BYTES, "file too large (25MB max)").optional()
});

/** `<uuid>-<key-safe name>`: the only object-name shape this module mints. */
const OBJECT_KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[A-Za-z0-9._-]+$/i;

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Build a unique storage key: `<projectId>/<uuid>-<key-safe name>`. */
function buildStoragePath(projectId: string, filename: string): string {
  return `${projectId}/${crypto.randomUUID()}-${keySafeName(filename)}`;
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

  // upsert:false: the signed token cannot overwrite an existing object.
  const path = buildStoragePath(project_id, filename);
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
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
  const { project_id, storage_path, filename, mime: declaredMime } = parsed.data;

  let admin, user;
  try {
    ({ admin, user } = await requireAdminAal2());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  // The path must live under this project's prefix and be a single object
  // name of the exact shape createDeliverableUploadUrl mints.
  const prefix = `${project_id}/`;
  const objectName = storage_path.startsWith(prefix) ? storage_path.slice(prefix.length) : "";
  if (
    !objectName ||
    !OBJECT_NAME_CHARSET.test(objectName) ||
    !OBJECT_KEY_RE.test(objectName) ||
    objectName.includes("..")
  ) {
    return { ok: false, error: "storage_path outside project namespace" };
  }
  // The key's extension decides the canonical MIME, never the browser.
  const canonicalMime = canonicalMimeForName(objectName);
  if (!canonicalMime) return { ok: false, error: "unsupported file extension" };
  if (declaredMime !== undefined && declaredMime !== canonicalMime) {
    return { ok: false, error: "file extension does not match file type" };
  }
  const nameMsg = filenameError(filename, canonicalMime);
  if (nameMsg) return { ok: false, error: nameMsg };

  // true / false, or null when the lookup failed (callers fail closed).
  const isReferenced = async (): Promise<boolean | null> => {
    const { data: rows, error: refError } = await admin
      .from("project_files")
      .select("id")
      .eq("storage_path", storage_path)
      .limit(1);
    if (refError) return null;
    return (rows ?? []).length > 0;
  };
  // A key is recorded once; never touch bytes a row already points at.
  if ((await isReferenced()) !== false) {
    return { ok: false, error: "storage_path already recorded" };
  }

  // Never trust client-declared size/mime: read the real object metadata.
  const bucket = admin.storage.from(BUCKET);
  const { data: info, error: infoError } = await bucket.info(storage_path);
  if (infoError || !info) {
    return { ok: false, error: "uploaded object not found" };
  }
  // storage-js camelizes the response (content_type -> contentType), but the
  // top-level size/content_type are optional; some Storage server versions
  // only report them under `metadata` (size, mimetype). Accept either.
  const meta = (info.metadata ?? {}) as { size?: unknown; mimetype?: unknown };
  const realSize = info.size ?? meta.size;
  const rawMime = info.contentType ?? (typeof meta.mimetype === "string" ? meta.mimetype : "");
  const realMime = rawMime.split(";")[0].trim().toLowerCase();
  const reject = async (message: string): Promise<ActionResult<{ id: string }>> => {
    // Remove only when no row references the key (fail closed on lookup error).
    if ((await isReferenced()) === false) await bucket.remove([storage_path]);
    return { ok: false, error: message };
  };
  if (typeof realSize !== "number" || !Number.isFinite(realSize) || realSize <= 0) {
    return reject("uploaded object has no size");
  }
  if (realSize > MAX_DELIVERABLE_BYTES) return reject(tooLargeMessage(realSize));
  if (realMime !== canonicalMime) return reject("file extension does not match file type");

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

  // project_files_storage_path_key (20261023000300) closes the race the
  // isReferenced() pre-check leaves open. A concurrent record of the same key
  // means a row now points at these bytes, so never remove the object here.
  if (error?.code === UNIQUE_VIOLATION) {
    return { ok: false, error: "storage_path already recorded" };
  }
  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };

  revalidatePath(`/admin/projects/${project_id}`);
  revalidatePath(`/portal/projects/${project_id}`);
  return { ok: true, data: { id: data.id } };
}
