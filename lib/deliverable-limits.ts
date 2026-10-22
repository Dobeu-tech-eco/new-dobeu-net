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
