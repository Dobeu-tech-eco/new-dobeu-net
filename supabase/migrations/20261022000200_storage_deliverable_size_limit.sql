-- Enforce the 25 MB deliverable cap and MIME allowlist at the storage layer.
-- Mirrors lib/deliverable-limits.ts. SVG is intentionally excluded (XSS).
-- Idempotent: safe to re-run. The bucket is created in 20260521000000_initial_schema.sql.
do $$
begin
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

  if not found then
    raise exception 'bucket project-files not found: refusing to deploy without the 25MB deliverable cap and MIME allowlist at the storage layer';
  end if;
end
$$;
