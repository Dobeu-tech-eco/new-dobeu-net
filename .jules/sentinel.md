## 2026-06-26 - Dropping profiles.is_admin

**Vulnerability:** The legacy logic used `is_admin` in `profiles` for row-level security (RLS), leaving an unused code footprint after authentication changed to check environmental configurations (`ADMIN_EMAILS`). Unused permission code can create accidental backdoor points.
**Learning:** Consolidating RLS changes alongside the actual column-drop migration step keeps the migration boundary clean.
**Prevention:** Always pair table/column physical drops with the cleanup of their associated security and access control logic in the same step.
