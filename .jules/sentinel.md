
## 2026-06-09 - [Rate Limit Bypass via IP Spoofing]
**Vulnerability:** The application blindly parsed `x-forwarded-for` and took the leftmost IP for rate-limiting, which allowed an attacker to bypass rate limits entirely by prepending arbitrary IPs to their requests.
**Learning:** `x-forwarded-for` can be trivially modified by external clients. The leftmost IP is the origin client IP but is completely untrustworthy. The rightmost IP is appended by the outermost trusted proxy and is safer, though `x-real-ip` (if provided by a trusted Edge network like Vercel) is the most secure identifier.
**Prevention:** Always prioritize `x-real-ip`. If forced to use `x-forwarded-for` in a multi-proxy setup, use the rightmost IP for enforcing security policies. Add tests mimicking malicious IP spoofing in headers.
