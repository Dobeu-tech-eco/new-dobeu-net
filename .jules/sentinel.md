## 2026-06-12 - Open Redirect via `next` URL Parameter
**Vulnerability:** The application was passing the `next` query parameter directly to `new URL(next, origin)` inside the auth callback redirect response. A malicious attacker could craft a login URL with `?next=//evil.com` or `?next=https://evil.com` that would bypass the origin and redirect authenticated users to an external malicious site.
**Learning:** `new URL(path, base)` will ignore the `base` if the `path` is an absolute URL (like `https://evil.com`) or a protocol-relative URL (like `//evil.com`).
**Prevention:** Always validate that redirect targets derived from user input are local paths. Use `next.startsWith("/") && !next.startsWith("//")` to ensure the redirect is strictly relative to the current origin.
