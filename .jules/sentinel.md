## 2026-06-17 - IP Spoofing Prevention
**Vulnerability:** IP spoofing in rate limiting logic by reading the leftmost IP from `x-forwarded-for`.
**Learning:** When determining client IPs (e.g., for rate limiting on Vercel), always prioritize the guaranteed `x-real-ip` header. If forced to parse `x-forwarded-for`, use the rightmost IP to prevent IP spoofing, but be cautious as taking the rightmost IP can introduce DoS risks in multi-proxy architectures.
**Prevention:** Use `x-real-ip` first, then fallback to `x-forwarded-for`'s rightmost IP using `.pop()`.

## 2025-02-26 - Prevent XSS in static components
**Vulnerability:** Use of `dangerouslySetInnerHTML` for static text allows XSS if the data source becomes tainted, and causes unnecessary risk when simple standard React children rendering is sufficient.
**Learning:** Avoid `dangerouslySetInnerHTML` unless rendering complex HTML that cannot be transformed safely. Static text with apostrophes or quotes does not require it.
**Prevention:** Use standard React text nodes (`<span>{text}</span>`) instead of `dangerouslySetInnerHTML={{ __html: text }}` for static strings.
