## 2026-06-17 - IP Spoofing Prevention
**Vulnerability:** IP spoofing in rate limiting logic by reading the leftmost IP from `x-forwarded-for`.
**Learning:** When determining client IPs (e.g., for rate limiting on Vercel), always prioritize the guaranteed `x-real-ip` header. If forced to parse `x-forwarded-for`, use the rightmost IP to prevent IP spoofing, but be cautious as taking the rightmost IP can introduce DoS risks in multi-proxy architectures.
**Prevention:** Use `x-real-ip` first, then fallback to `x-forwarded-for`'s rightmost IP using `.pop()`.

## 2024-06-25 - Prevent Protocol-Relative Open Redirects
**Vulnerability:** Open redirect vulnerability in `sanitizeNextPath` where paths starting with `/\` could bypass the relative path check and be interpreted as protocol-relative URLs by browsers.
**Learning:** Browsers normalize `/\` to `//`, allowing attackers to craft protocol-relative links (e.g., `/\evil.com`) that bypass simple `startsWith('/')` and `startsWith('//')` validation.
**Prevention:** Always explicitly block `/\` alongside `//` when validating local, relative paths to prevent protocol-relative bypasses.
