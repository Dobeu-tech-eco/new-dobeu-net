## 2024-05-24 - [Open Redirect in Auth Callback]
**Vulnerability:** The `app/auth/callback/route.ts` blindly redirects users using the `next` search parameter, which can be easily manipulated to redirect users to an external attacker-controlled domain by appending an absolute URL to the parameter like `?next=https://evil.com`.
**Learning:** Never trust the `next` query parameter or any user-controlled input for redirects. Unvalidated redirects can be used in phishing attacks.
**Prevention:** Validate that the redirect URL is relative to the application's root by checking that it starts with a `/` and does not start with `//` or by explicitly checking the hostname if absolute URLs are allowed.
