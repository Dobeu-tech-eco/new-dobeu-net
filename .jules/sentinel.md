## 2026-06-17 - IP Spoofing Prevention
**Vulnerability:** IP spoofing in rate limiting logic by reading the leftmost IP from `x-forwarded-for`.
**Learning:** When determining client IPs (e.g., for rate limiting on Vercel), always prioritize the guaranteed `x-real-ip` header. If forced to parse `x-forwarded-for`, use the rightmost IP to prevent IP spoofing, but be cautious as taking the rightmost IP can introduce DoS risks in multi-proxy architectures.
**Prevention:** Use `x-real-ip` first, then fallback to `x-forwarded-for`'s rightmost IP using `.pop()`.
## 2025-01-20 - [Fix] Remove dangerouslySetInnerHTML in Founder component
**Vulnerability:** The `Founder` component used `dangerouslySetInnerHTML` to render a list of strings (`REASONS`). While currently static, this pattern introduces a severe risk of Cross-Site Scripting (XSS) if the data source becomes dynamic or incorporates user input in the future.
**Learning:** Avoid using `dangerouslySetInnerHTML` for rendering plain text or simple strings. React's default escaping mechanism is sufficient and safer for standard content.
**Prevention:** Always use standard React child rendering `{variable}` for text content. Reserve `dangerouslySetInnerHTML` strictly for scenarios where rendering sanitized rich HTML from a highly trusted source is absolute necessary, and always ensure proper sanitization.
