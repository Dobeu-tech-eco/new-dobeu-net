## 2026-06-26 - Dropping profiles.is_admin

**Vulnerability:** The legacy logic used `is_admin` in `profiles` for row-level security (RLS), leaving an unused code footprint after authentication changed to check environmental configurations (`ADMIN_EMAILS`). Unused permission code can create accidental backdoor points.
**Learning:** Consolidating RLS changes alongside the actual column-drop migration step keeps the migration boundary clean.
**Prevention:** Always pair table/column physical drops with the cleanup of their associated security and access control logic in the same step.

## 2026-06-17 - IP Spoofing Prevention
**Vulnerability:** IP spoofing in rate limiting logic by reading the leftmost IP from `x-forwarded-for`.
**Learning:** When determining client IPs (e.g., for rate limiting on Vercel), always prioritize the guaranteed `x-real-ip` header. If forced to parse `x-forwarded-for`, use the rightmost IP to prevent IP spoofing, but be cautious as taking the rightmost IP can introduce DoS risks in multi-proxy architectures.
**Prevention:** Use `x-real-ip` first, then fallback to `x-forwarded-for`'s rightmost IP using `.pop()`.
