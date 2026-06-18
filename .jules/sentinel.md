## 2026-06-17 - IP Spoofing Prevention
**Vulnerability:** IP spoofing in rate limiting logic by reading the leftmost IP from `x-forwarded-for`.
**Learning:** When determining client IPs (e.g., for rate limiting on Vercel), always prioritize the guaranteed `x-real-ip` header. If forced to parse `x-forwarded-for`, use the rightmost IP to prevent IP spoofing, but be cautious as taking the rightmost IP can introduce DoS risks in multi-proxy architectures.
**Prevention:** Use `x-real-ip` first, then fallback to `x-forwarded-for`'s rightmost IP using `.pop()`.

## 2026-06-18 - Open Redirect Path Bypass
**Vulnerability:** Open Redirect bypass via protocol-relative path normalization.
**Learning:** Checking that a redirect path starts with `/` and doesn't start with `//` is insufficient. Attackers can use paths like `/\evil.com` which some parsers (including Node.js's `URL` constructor) normalize into protocol-relative URLs (`//evil.com`), leading to a cross-origin redirect.
**Prevention:** To prevent open redirect vulnerabilities when using URL `next` parameters for redirection, always validate that the target is a local path by explicitly blocking protocol-relative bypasses like `//` and `/\` (e.g., `next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")`) before passing it to `new URL()`.
