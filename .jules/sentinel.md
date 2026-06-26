## 2026-06-17 - IP Spoofing Prevention
**Vulnerability:** IP spoofing in rate limiting logic by reading the leftmost IP from `x-forwarded-for`.
**Learning:** When determining client IPs (e.g., for rate limiting on Vercel), always prioritize the guaranteed `x-real-ip` header. If forced to parse `x-forwarded-for`, use the rightmost IP to prevent IP spoofing, but be cautious as taking the rightmost IP can introduce DoS risks in multi-proxy architectures.
**Prevention:** Use `x-real-ip` first, then fallback to `x-forwarded-for`'s rightmost IP using `.pop()`.

## 2024-06-26 - Update CookieBanner rendering
**Vulnerability:** The CookieBanner component used dangerouslySetInnerHTML to render the category label, exposing the application to potential XSS if the label was ever controlled by user input or an external source.
**Learning:** Even static or seemingly safe string props should not use dangerouslySetInnerHTML if standard React children rendering can achieve the same result.
**Prevention:** Avoid dangerouslySetInnerHTML entirely unless absolutely necessary for rendering trusted, sanitized HTML content.

## 2024-06-26 - Allow bots in Claude Code Action
**Vulnerability:** GitHub Action workflow failed when initiated by a non-human actor (`google-labs-jules`) without explicit permission in `claude-code-action`.
**Learning:** When configuring `anthropics/claude-code-action` in GitHub workflows, explicitly declare allowed bots using `allowed_bots` to prevent 'non-human actor' execution errors.
**Prevention:** Add `allowed_bots: "google-labs-jules"` (or `"*"` if appropriate) to the action inputs.
