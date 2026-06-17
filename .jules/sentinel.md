## 2025-02-14 - Fix Unbounded Rate Limiting Map Memory Exhaustion DoS
**Vulnerability:** The in-memory Map (`ipBuckets`) used for IP rate limiting in `app/api/lead/route.ts` grew unbounded. A malicious actor could spoof `x-forwarded-for` IPs to exhaust server memory and cause a DoS attack.
**Learning:** In-memory Maps or objects used for caching, rate limiting, or state tracking without upper bounds or cleanup mechanisms are a significant DoS risk.
**Prevention:** Always implement an explicit size limit and cleanup strategy (like evicting expired items or clearing the structure) when using in-memory data structures for tracking untrusted inputs.
