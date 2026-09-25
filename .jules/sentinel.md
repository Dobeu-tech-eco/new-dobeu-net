## 2026-06-17 - IP Spoofing Prevention
**Vulnerability:** DoS vulnerability by extracting the rightmost IP from `x-forwarded-for`.
**Learning:** When determining client IPs (e.g., for rate limiting on Vercel), always prioritize the guaranteed `x-real-ip` header. If falling back to `x-forwarded-for`, extract the first (leftmost) IP which represents the original client. Do not use the rightmost IP (`.pop()`) in a multi-proxy setup, as this targets the proxy's IP and causes a Denial of Service (DoS).
**Prevention:** Use `x-real-ip` first, then fallback to `x-forwarded-for`'s leftmost IP using `[0]`.
