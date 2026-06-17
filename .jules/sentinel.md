## 2023-10-24 - [IP Spoofing via X-Forwarded-For Header]
**Vulnerability:** The application was extracting the client IP address from the *leftmost* part of the `X-Forwarded-For` header for rate limiting. This is a critical security risk because a malicious client can easily spoof the leftmost IP address by injecting their own `X-Forwarded-For` header, bypassing the rate limiter.
**Learning:** The leftmost IP address in `X-Forwarded-For` is untrusted because it originates from the client.
**Prevention:** Always extract the client IP address from the *rightmost* part of the `X-Forwarded-For` header (after splitting by commas and trimming whitespace), as this value is appended by the last trusted proxy (e.g., Vercel) and cannot be spoofed by the client.
