## 2024-06-11 - Open Redirect via Unvalidated `next` Parameter
**Vulnerability:** The OAuth callback route (`/auth/callback`) blindly trusted the `next` query parameter and passed it directly to `new URL(next, url.origin)`. An attacker could supply an absolute URL or a protocol-relative URL (e.g., `//attacker.com`) to redirect authenticated users to a malicious site.
**Learning:** `new URL(path, base)` will ignore the `base` if the `path` is already an absolute URL or a protocol-relative URL. Relying on this constructor to forcefully scope paths to the origin is insufficient without explicit validation.
**Prevention:** Always validate that redirect targets derived from user input are strictly local paths (e.g., `next.startsWith("/") && !next.startsWith("//")`) before execution.
