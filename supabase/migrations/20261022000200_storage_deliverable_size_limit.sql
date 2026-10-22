-- Enforce the 25 MB deliverable cap and MIME allowlist at the storage layer.
-- Mirrors MAX_DELIVERABLE_BYTES / ALLOWED_DELIVERABLE_MIME in lib/actions/files.ts.
-- Idempotent: safe to re-run.
update storage.buckets
set
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'application/pdf',
    'application/zip',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'video/mp4'
  ]
where id = 'project-files';
