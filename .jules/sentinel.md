## 2026-06-17 - IP Spoofing Prevention
**Vulnerability:** IP spoofing in rate limiting logic by reading the leftmost IP from `x-forwarded-for`.
**Learning:** When determining client IPs (e.g., for rate limiting on Vercel), always prioritize the guaranteed `x-real-ip` header. If forced to parse `x-forwarded-for`, use the rightmost IP to prevent IP spoofing, but be cautious as taking the rightmost IP can introduce DoS risks in multi-proxy architectures.
**Prevention:** Use `x-real-ip` first, then fallback to `x-forwarded-for`'s rightmost IP using `.pop()`.
## 2025-01-20 - Fix XSS in JSON-LD Injection
**Vulnerability:** Unescaped JSON was injected directly into a script tag via `dangerouslySetInnerHTML` for JSON-LD structured data, creating a potential XSS vulnerability if input properties contain unescaped HTML tags.
**Learning:** `JSON.stringify` does not escape HTML-sensitive characters like `<`, `>`, and `&`. When injecting JSON into HTML documents, these characters can be parsed by the browser before the JavaScript engine receives them, allowing arbitrary code execution.
**Prevention:** Always use a safe stringification method (e.g., replacing `<`, `>`, and `&` with their unicode escapes like `\u003c`) when injecting JSON into `<script>` tags, especially when using `dangerouslySetInnerHTML`.
