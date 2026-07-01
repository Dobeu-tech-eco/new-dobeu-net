## 2026-06-17 - IP Spoofing Prevention
**Vulnerability:** IP spoofing in rate limiting logic by reading the leftmost IP from `x-forwarded-for`.
**Learning:** When determining client IPs (e.g., for rate limiting on Vercel), always prioritize the guaranteed `x-real-ip` header. If forced to parse `x-forwarded-for`, use the rightmost IP to prevent IP spoofing, but be cautious as taking the rightmost IP can introduce DoS risks in multi-proxy architectures.
**Prevention:** Use `x-real-ip` first, then fallback to `x-forwarded-for`'s rightmost IP using `.pop()`.
## 2026-07-01 - SSRF via Path Traversal in URL Parsing
**Vulnerability:** The GitHub repo API route (app/api/github-repo/route.ts) parsed URLs without strictly validating the path segments. This allowed inputs like `https://github.com/../user` to be parsed as owner="..", repo="user", which could then be used in internal backend requests (e.g. `https://api.github.com/repos/../user`), potentially leading to Server-Side Request Forgery (SSRF) and fetching unexpected endpoints or exposing tokens.
**Learning:** Always explicitly validate parsed URL path segments against expected formats (e.g., alphanumeric, hyphens) and reject sequences like `..` before utilizing them in downstream backend requests.
**Prevention:** Use strict regex validation on extracted `owner` and `repo` components to block path traversal characters before making fetch calls.
