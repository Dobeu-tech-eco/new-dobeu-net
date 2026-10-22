/**
 * Shared deliverable upload limits (plain module: importable from both the
 * "use server" action and the client component).
 *
 * MIME allowlist: pdf, common raster images (png/jpeg/webp/gif), zip, Office
 * docs (doc/docx/xls/xlsx/ppt/pptx), text/plain, text/csv, video/mp4.
 * SVG is intentionally excluded (script-capable, XSS risk when rendered inline).
 * Keep in sync with supabase/migrations/20261022000200_storage_deliverable_size_limit.sql.
 */

/** 25 MB ceiling. */
export const MAX_DELIVERABLE_BYTES = 25 * 1024 * 1024;

export const ALLOWED_DELIVERABLE_MIME = [
  "application/pdf",
  "application/zip",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/mp4"
] as const;

/** User-facing over-cap message; size shown in MB with one decimal. */
export function tooLargeMessage(bytes: number): string {
  return `File too large: ${(bytes / (1024 * 1024)).toFixed(1)} MB. Deliverables are capped at 25 MB.`;
}

/**
 * Extension -> MIME map. Every value must be in ALLOWED_DELIVERABLE_MIME. A
 * filename's extension must appear here and map to the declared MIME, so an
 * `.svg`, `.html` or `.docm` can never be stored under an allowlisted type.
 */
export const EXTENSION_MIME: Readonly<Record<string, (typeof ALLOWED_DELIVERABLE_MIME)[number]>> = {
  pdf: "application/pdf",
  zip: "application/zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  mp4: "video/mp4"
};

export const MAX_FILENAME_LENGTH = 120;

/** Allowlist charset; no percent-encodings, quotes, separators or control chars. */
const FILENAME_CHARSET = /^[A-Za-z0-9._ -]+$/;

/**
 * Strict charset for the storage object key's file part (no spaces). Storage
 * interpolates the key into URLs unencoded, so the key must stay URL-safe.
 */
export const OBJECT_NAME_CHARSET = /^[A-Za-z0-9._-]+$/;

/** Derive the URL-safe part of an object key from a display filename. */
export function keySafeName(filename: string): string {
  return filename
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Canonical MIME for a name's last extension, or null when not allowlisted. */
export function canonicalMimeForName(name: string): string | null {
  const dot = name.lastIndexOf(".");
  const ext = dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
  return Object.prototype.hasOwnProperty.call(EXTENSION_MIME, ext) ? EXTENSION_MIME[ext] : null;
}

/** Returns an error message, or null when the filename is acceptable for `mime`. */
export function filenameError(filename: string, mime?: string): string | null {
  if (filename.length === 0) return "filename required";
  if (filename.length > MAX_FILENAME_LENGTH) return "filename too long";
  if (!FILENAME_CHARSET.test(filename)) {
    return "filename may only contain letters, digits, dot, space, underscore and hyphen";
  }
  if (filename.startsWith(".") || filename.includes("..")) return "invalid filename";
  const dot = filename.lastIndexOf(".");
  const ext = dot < 0 ? "" : filename.slice(dot + 1).toLowerCase();
  const expected = Object.prototype.hasOwnProperty.call(EXTENSION_MIME, ext) ? EXTENSION_MIME[ext] : undefined;
  if (!expected) return "unsupported file extension";
  if (mime !== undefined && expected !== mime) return "file extension does not match file type";
  return null;
}

/** Human-readable list of allowed extensions for UI hints. */
export const ALLOWED_EXTENSIONS_LABEL = Object.keys(EXTENSION_MIME)
  .map((e) => `.${e}`)
  .join(", ");
