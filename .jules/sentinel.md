## 2025-05-29 - Open Redirect in Auth Callback
**Vulnerability:** The `/auth/callback` route used the `next` query parameter directly in a `new URL(next, url.origin)` call without validation, allowing attackers to redirect users to malicious sites after successful authentication via `next=http://evil.com`.
**Learning:** `new URL(path, base)` will ignore the `base` if the `path` is an absolute URL, leading to Open Redirect vulnerabilities if user input is used for `path`.
**Prevention:** Always sanitize and validate redirect URLs derived from query parameters. Ensure they are relative paths by checking `startsWith("/")` and explicitly rejecting protocol-relative URLs (`startsWith("//")`).
