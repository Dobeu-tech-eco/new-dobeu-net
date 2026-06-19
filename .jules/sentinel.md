## 2026-06-17 - IP Spoofing Prevention
**Vulnerability:** IP spoofing in rate limiting logic by reading the leftmost IP from `x-forwarded-for`.
**Learning:** When determining client IPs (e.g., for rate limiting on Vercel), always prioritize the guaranteed `x-real-ip` header. If forced to parse `x-forwarded-for`, use the rightmost IP to prevent IP spoofing, but be cautious as taking the rightmost IP can introduce DoS risks in multi-proxy architectures.
**Prevention:** Use `x-real-ip` first, then fallback to `x-forwarded-for`'s rightmost IP using `.pop()`.

## 2026-06-18 - Open Redirect Bypass with /\
**Vulnerability:** Open redirect bypass where `/\` is used instead of `//` to create a protocol-relative URL that bypasses simple prefix checks in `sanitizeNextPath`.
**Learning:** To prevent open redirect vulnerabilities when using URL next parameters for redirection, always validate that the target is a local path by ensuring it starts with `/` and explicitly blocking protocol-relative bypasses like `//` and `/\`.
**Prevention:** Ensure the condition explicitly checks and blocks `!next.startsWith("/\\")` alongside `//`.
