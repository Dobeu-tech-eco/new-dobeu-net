## 2026-06-17 - IP Spoofing Prevention
**Vulnerability:** IP spoofing in rate limiting logic by reading the leftmost IP from `x-forwarded-for`.
**Learning:** When determining client IPs (e.g., for rate limiting on Vercel), always prioritize the guaranteed `x-real-ip` header. If forced to parse `x-forwarded-for`, use the rightmost IP to prevent IP spoofing, but be cautious as taking the rightmost IP can introduce DoS risks in multi-proxy architectures.
**Prevention:** Use `x-real-ip` first, then fallback to `x-forwarded-for`'s rightmost IP using `.pop()`.

## 2026-06-29 - Prevent XSS Risk via dangerouslySetInnerHTML
**Vulnerability:** Widespread use of `dangerouslySetInnerHTML` in React components to render plain text strings (e.g., in FAQ, HowItWorks, Proof, Founder, CookieBanner).
**Learning:** Using `dangerouslySetInnerHTML` for simple text (even if currently hardcoded) introduces an unnecessary XSS risk if those values are ever migrated to be user-provided or fetched dynamically. HTML entities (`&apos;`, `&quot;`) caused developers to use raw HTML rendering.
**Prevention:** Always use standard React child interpolation (e.g., `{variable}`) which natively escapes output, and manually replace HTML entities with their literal equivalents in source strings.
