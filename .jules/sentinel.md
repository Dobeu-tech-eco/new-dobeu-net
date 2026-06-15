## 2024-05-24 - Open Redirect in Auth Callback
**Vulnerability:** Open redirect vulnerability in /auth/callback when using the next parameter.
**Learning:** User input used in redirections must be validated to ensure it targets local paths. Failing to do so exposes the app to phishing and token leakage.
**Prevention:** Always validate that the target is a local path (e.g., next.startsWith("/") && !next.startsWith("//")) before passing it to new URL() or a redirect response.
