## 2026-06-17 - IP Spoofing Prevention
**Vulnerability:** IP spoofing in rate limiting logic by reading the leftmost IP from `x-forwarded-for`.
**Learning:** When determining client IPs (e.g., for rate limiting on Vercel), always prioritize the guaranteed `x-real-ip` header. If forced to parse `x-forwarded-for`, use the rightmost IP to prevent IP spoofing, but be cautious as taking the rightmost IP can introduce DoS risks in multi-proxy architectures.
**Prevention:** Use `x-real-ip` first, then fallback to `x-forwarded-for`'s rightmost IP using `.pop()`.

## 2026-06-27 - Open Redirect via Path Normalization
**Vulnerability:** Open redirect via `sanitizeNextPath` allowing `/\` strings which bypass `.startsWith("/")` logic but are normalized by browsers to `//`.
**Learning:** Checking for `//` is not enough. Browsers normalize `/\` into protocol-relative slashes as well, making `/\evil.com` a valid open redirect vector.
**Prevention:** In local path validation logic, explicitly block both `//` and `/\` to prevent bypasses via browser normalization.
