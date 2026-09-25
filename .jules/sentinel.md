## 2026-06-17 - IP Spoofing Prevention
**Vulnerability:** IP spoofing in rate limiting logic by reading the leftmost IP from `x-forwarded-for`.
**Learning:** When determining client IPs (e.g., for rate limiting on Vercel), always prioritize the guaranteed `x-real-ip` header. If forced to parse `x-forwarded-for`, use the rightmost IP to prevent IP spoofing, but be cautious as taking the rightmost IP can introduce DoS risks in multi-proxy architectures.
**Prevention:** Use `x-real-ip` first, then fallback to `x-forwarded-for`'s rightmost IP using `.pop()`.

## 2026-09-21 - IP Spoofing Fix introduces DoS Regression
**Vulnerability:** Naively picking the rightmost IP from `x-forwarded-for` for rate limiting.
**Learning:** Picking the `.pop()` IP from `x-forwarded-for` causes the system to rate-limit the nearest shared proxy rather than the individual client. This leads to severe Denial of Service (DoS) where legitimate users are blocked because the proxy hits the rate limit.
**Prevention:** Always parse `x-forwarded-for` from right-to-left while explicitly skipping known/trusted proxy IP ranges to find the true client IP, rather than blindly taking the last IP.
