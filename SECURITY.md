# Security

## Accepted risks — deliverable uploads

Uploads are admin-only (`requireAdminAal2`: `ADMIN_EMAILS` plus MFA AAL2). The
bucket enforces a 25 MB cap and a MIME allowlist; the actions verify the real
object metadata before a `project_files` row exists.

- **Signed URL `download` flag is unsigned.** Storage appends `&download` outside
  the token, so a client can strip it and get inline rendering. Mitigated by the
  verified-metadata check, the strict filename/extension map, and the bucket
  MIME allowlist (no SVG/HTML), so nothing script-capable is stored.
- **Re-upload after record.** The upload token is multi-use until it expires, so
  bytes can be replaced after `recordDeliverable` verified them. The row only
  ever records verified metadata, the bucket allowlist still applies to any
  replacement PUT, and the token expires in about two hours. Residual risk:
  size/type of a replaced object can differ from the row until re-verified.
- **Active content inside allowed types.** PDF JavaScript, CSV formulas and zip
  contents are not scanned. Deliverables are supplied by trusted admins; clients
  should treat them like any emailed attachment.
- **Legacy objects.** Objects uploaded before SVG was removed from the allowlist
  are not rewritten by the migration. Company members can read `project_files`
  rows but storage SELECT is owner-only, so their download returns 500; this is a
  known deferred product item (D2).
