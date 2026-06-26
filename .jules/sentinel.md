## 2026-06-17 - IP Spoofing Prevention
**Vulnerability:** IP spoofing in rate limiting logic by reading the leftmost IP from `x-forwarded-for`.
**Learning:** When determining client IPs (e.g., for rate limiting on Vercel), always prioritize the guaranteed `x-real-ip` header. If forced to parse `x-forwarded-for`, use the rightmost IP to prevent IP spoofing, but be cautious as taking the rightmost IP can introduce DoS risks in multi-proxy architectures.
**Prevention:** Use `x-real-ip` first, then fallback to `x-forwarded-for`'s rightmost IP using `.pop()`.

## 2025-01-08 - JSON-LD XSS Prevention
**Vulnerability:** Unescaped JSON strings injected into `<script>` tags via `dangerouslySetInnerHTML` can lead to XSS if an attacker can inject arbitrary HTML tags like `</script><script>alert(1)</script>`.
**Learning:** `JSON.stringify` does not escape `<` or `>` characters by default. When inserting JSON inside a script tag within HTML, these characters must be explicitly escaped to prevent the browser from closing the script tag early.
**Prevention:** Always use a helper function to replace `<` with `\u003c` and `>` with `\u003e` after stringifying the JSON when placing it inside HTML script tags.
