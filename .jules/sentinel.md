## 2023-10-24 - [Fix IP Spoofing vulnerability]
**Vulnerability:** X-Forwarded-For allowed clients to spoof their IP, bypassing rate limits.
**Learning:** Client-supplied headers appear on the left of `X-Forwarded-For`. Taking `split(',')[0]` yields a spoofed IP. However, strictly using `.pop()` (the rightmost IP) works for single-hop proxies but breaks in multi-hop configurations (like Cloudflare -> Load Balancer), potentially causing an entire node of users to be rate limited together.
**Prevention:** Rely on guaranteed headers like Vercel's `X-Real-IP` if available to fetch the actual client IP securely. Use `.pop()` as a fallback carefully, mindful of multi-proxy limitations, to prevent basic IP spoofing while minimizing the risk of a DoS condition on shared IPs.
