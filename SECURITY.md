# Security

## Accepted risks — deliverable uploads

Uploads are admin-only (`requireAdminAal2`: `ADMIN_EMAILS` plus MFA AAL2). The
bucket enforces a 25 MB cap and a MIME allowlist; the actions verify the real
object metadata before a `project_files` row exists. Object keys are unique and
server-generated, and upload tokens are minted with `upsert: false`, so a reused
token cannot replace stored bytes.

- **Signed URL `download` flag is unsigned.** Storage appends `&download` outside
  the token, so a client can strip it and get inline rendering. Mitigated by the
  verified-metadata check, the strict filename/extension map, and the bucket
  MIME allowlist (no SVG/HTML), so nothing script-capable is stored.
- **Active content inside allowed types.** PDF JavaScript, CSV formulas and zip
  contents are not scanned. Deliverables are supplied by trusted admins; clients
  should treat them like any emailed attachment.
- **Legacy objects.** Objects uploaded before SVG was removed from the allowlist
  are not rewritten by the migration. Company members can read `project_files`
  rows but storage SELECT is owner-only, so their download returns 500; this is a
  known deferred product item (D2).
