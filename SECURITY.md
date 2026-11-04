# Security policy

Report suspected vulnerabilities privately to [jeremyw@dobeu.net](mailto:jeremyw@dobeu.net).
Include the affected version, reproduction steps, and likely impact. Do not put
credentials, personal data, or exploit details in public issues or pull requests.

## Dependency and pull request checks

Dependabot checks npm dependencies, GitHub Actions, and the Docker image in
`/containers/function` weekly. Review its security updates promptly. Cursor Bugbot
is the PR reviewer; address its security findings before merging.

GitHub Actions runs on every pull request: the `Verify` job (`pnpm verify`) and the
`secret-scan` gitleaks job are the merge gate. Run `pnpm verify` locally before
pushing, and run the relevant Playwright and Lighthouse checks for changes
that affect those surfaces. A local build that skips source-map upload can use
`pnpm exec next build`; it does not replace the full merge gate.

Run `pnpm audit --audit-level high` for all dependencies and
`pnpm audit --prod --audit-level high` for production dependencies. Keep fixes in
the existing major version unless a major upgrade is separately reviewed.
Audit exceptions below are advisory-specific and must be revisited when upstream
fixes or a reviewed dependency replacement become available. Review the linked
advisories below as well as the filtered audit results.

## Secret prevention

Install Gitleaks (`winget install gitleaks` or `brew install gitleaks`), then enable
the repository hook with `git config core.hooksPath .githooks`. The pre-commit hook
runs `gitleaks protect --staged --redact` when installed; otherwise it prints a
warning that the commit was not scanned and allows it (fail-open). The
secret-scan CI workflow (`.github/workflows/secret-scan.yml`) runs gitleaks on
every push and pull request to `main` and is the enforcing layer. The
`.gitleaks.toml` configuration extends the default rules and allowlists only
placeholder values (`your-...-here`, optionally behind `sk_test_`, `ghp_`,
`whsec_`, or `re_`) in the root `.env.example`; a real-looking key there is still
flagged. CI scans full history; the reviewed historical findings (public anon
keys and analytics tokens, plus one commit-SHA false positive) are baselined by
exact fingerprint in `.gitleaksignore`, so any new finding still fails.

Enable secret scanning and push protection in GitHub repository settings. These
are repository settings, not guarantees supplied by a local hook; verify their
enabled state as an operator. Never commit real `.env` values or credentials.

## Accepted risk

Reviewed on 2026-10-22 under the T2 lead ruling. These packages remain vulnerable;
the advisory-specific audit exceptions do not fix them. Lighthouse dependencies
are dev-only. Although pnpm includes Tailwind's build tools in the production
dependency graph through `tailwindcss-animate`, they process styles at build time
and do not execute in application request handlers or browser code. The lead
accepted this build-time exposure for braces; it is not a runtime dependency fix.

| Package           | GHSA                                                                     | Dependency path                                                                                                                                                                                                                           | Runtime exclusion and acceptance reason                                                                                                                                                                                | Revisit trigger                                                                                                           |
| ----------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| extract-zip 2.0.1 | [GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv) | `@lhci/cli > lighthouse > puppeteer-core > @puppeteer/browsers > extract-zip`                                                                                                                                                             | Lighthouse's development browser-download tooling; absent from production dependencies and application runtime. No upstream fixed version reported.                                                                    | Upstream patch or Dependabot alert; review before exposing archive extraction as a service.                               |
| extract-zip 2.0.1 | [GHSA-7pqw-9j4j-h8q3](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3) | `@lhci/cli > lighthouse > puppeteer-core > @puppeteer/browsers > extract-zip`                                                                                                                                                             | Lighthouse's development browser-download tooling; absent from production dependencies and application runtime. No upstream fixed version reported.                                                                    | Upstream patch or Dependabot alert; review before exposing archive extraction as a service.                               |
| sprintf-js 1.0.3  | [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) | `@lhci/cli > @lhci/utils > js-yaml > argparse > sprintf-js`                                                                                                                                                                               | Lighthouse CLI argument formatting; absent from production dependencies and application runtime. No upstream fixed version reported (moderate severity).                                                               | Upstream patch or Dependabot alert; review before accepting untrusted format strings in a service.                        |
| basic-ftp 5.3.1   | [GHSA-c475-qrg2-pj4r](https://github.com/advisories/GHSA-c475-qrg2-pj4r) | `@lhci/cli > proxy-agent > pac-proxy-agent > get-uri > basic-ftp`                                                                                                                                                                         | Lighthouse's development proxy tooling; absent from production dependencies and application runtime. The reported fix is >=6.2.1, requiring a separately reviewed major upgrade from 5.x.                              | Upstream 5.x patch, reviewed upgrade/replacement, or Dependabot alert; review before exposing FTP tooling as a service.   |
| braces 3.0.3      | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | `tailwindcss-animate > tailwindcss > chokidar > braces`; also `tailwindcss > micromatch > braces`, `tailwindcss > fast-glob > micromatch > braces`, and `eslint-config-next > @next/eslint-plugin-next > fast-glob > micromatch > braces` | Chokidar is Tailwind's build-time file watcher; the other paths are style compilation and lint tooling. They never execute at request time or ship in application runtime bundles. No upstream fixed version reported. | Upstream patch or Dependabot alert; reassess if Tailwind, glob processing, or file watching moves into request-time code. |
| deepmerge 4.3.1 (low) | [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | `resend > @react-email/render > html-to-text > deepmerge` | Server-side email rendering. html-to-text merges its own static formatter options; no request or user data is passed as a merge source, and every template is fixed copy (`lib/resend-templates.ts`). No upstream fixed version reported (advisory lists no patched range). Not in `ignoreGhsas`: low severity does not fail the `--audit-level high` gates. Reviewed 2026-11-04. | Upstream patch, a resend/@react-email upgrade that drops it, or any change that passes user-controlled objects into email rendering options. |

### Ignored GHSA review schedule

`ignoreGhsas` is global: pnpm applies each ID to every dependency path, not only the
paths listed here. Each entry was reviewed on 2026-10-22 and must be re-reviewed by
2027-01-22 (or on its revisit trigger, whichever is first).

| GHSA                | Reviewed on | Re-review by | Exact dependency path(s)                                                                                                                                          |
| ------------------- | ----------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GHSA-jmr9-qjv8-65gv | 2026-10-22  | 2027-01-22   | `@lhci/cli > lighthouse > puppeteer-core > @puppeteer/browsers > extract-zip`                                                                                      |
| GHSA-7pqw-9j4j-h8q3 | 2026-10-22  | 2027-01-22   | `@lhci/cli > lighthouse > puppeteer-core > @puppeteer/browsers > extract-zip`                                                                                      |
| GHSA-hp3w-g68c-fv3c | 2026-10-22  | 2027-01-22   | `@lhci/cli > @lhci/utils > js-yaml > argparse > sprintf-js`                                                                                                        |
| GHSA-c475-qrg2-pj4r | 2026-10-22  | 2027-01-22   | `@lhci/cli > proxy-agent > pac-proxy-agent > get-uri > basic-ftp`; also via `@puppeteer/browsers > proxy-agent > pac-proxy-agent > get-uri > basic-ftp`             |
| GHSA-vfj7-8cjw-p6xm | 2026-10-22  | 2027-01-22   | `tailwindcss-animate > tailwindcss > chokidar > braces`, `tailwindcss > micromatch > braces`, `tailwindcss > fast-glob > micromatch > braces`, `eslint-config-next > @next/eslint-plugin-next > fast-glob > micromatch > braces` |

Only these five GHSAs are ignored in `package.json` under
`pnpm.auditConfig.ignoreGhsas`, supported by the pinned pnpm 10.34.1 audit command
(see [pnpm audit configuration](https://pnpm.io/10.x/cli/audit#configuration)).
Do not feed untrusted archives, format strings, glob patterns, or FTP endpoints
into the affected developer tools. Reassess every exception on the triggers above
or a dependency classification change. Any new runtime exposure needs a separate
review; an audit passing with these exceptions does not mean the dependency graph
contains no vulnerabilities.

## Accepted risks — email sign-in links (token_hash)

Supabase-sent invite and magic-link emails (admin `inviteUser`, `provisionCompanyAdmin`, `/login` magic links) carry a one-time `token_hash`. Company-member invites (`lib/actions/members.ts` `inviteMember`) carry no token at all: a fixed-copy Resend email links to `/login?next=/portal`, and the invitee requests their own sign-in link there, then accepts or declines the invite on their portal (`lib/actions/invites.ts`: service-role conditional update `invited` to `active`, bound to the signed-in user id and an active company, audited `company_member.accept` / `company_member.decline`; no rate limit on accept). Accept and decline (for every invited row, whichever path created it) require an email-link sign-in (otp, magiclink, invite or signup confirmation) made after the invite was created, with the account email unchanged since that sign-in (the email identity's `updated_at`), and refuse when an email change was requested after the invite was created (`email_change_sent_at`); `email_confirmed_at` alone is not proof of mailbox control because the checked-in Auth config auto-confirms password sign-ups. `inviteMember` attaches an existing account only if its current email was proven by an email-link sign-in, recorded in `app_metadata.email_link_signin` by the auth callbacks (`lib/email-link-signin.ts`), which write the marker only when the link was requested after the last email change; the attach guard itself is `inviteMember`-only (`provisionCompanyAdmin` is D49/D60). An account that has signed in but never that way is refused. A successful accept revokes the user's other sessions. The app-side checks do not rely on Confirm email, but locally an email change completes from either address alone while confirmations are off; turning on hosted Confirm email and secure email change (D53) is required hardening for every other auth path. Residual risk: a password the account holder set earlier keeps working after accept; rotating it is a follow-up decision. Accept also re-checks the company after the write and reverts if it was suspended in between; invites for a suspended company stay listed and can be declined; a repeated accept returns success and a second decline reports the invite as unavailable. The gate treats `otp` as mailbox proof and assumes phone/SMS sign-in stays disabled (`supabase/config.toml` `[auth.sms]`); enabling it requires revisiting the gate (D53). Admin-role invitees land on `/company?company=<id>` after accepting and must pass the two-factor step-up there. `/auth/callback` never
verifies it on GET: it parks the token in a short-lived (120 s) httpOnly, Lax,
`/auth/confirm`-scoped cookie and shows a "Continue signing in" step; only the
Origin-checked POST to `/auth/confirm/submit` calls `verifyOtp`. This defeats
mail-scanner prefetch, cross-site auto-submit, and token leakage into URLs,
Referer, analytics, and Datadog (`token_hash` is a redacted query key).

Residual (accepted 2026-10-22): a victim who opens an attacker's own sign-in link
and clicks Continue is signed into the attacker's account. This is inherent to
OTP links that are not bound to the browser that requested them; Supabase cannot
reveal the target identity without consuming the token. An already-signed-in
visitor is no longer switched silently: `/auth/confirm` asks them to sign out
and reopen the email link, and `/auth/confirm/submit` independently refuses to
call `verifyOtp` while a session exists (it clears the pending cookie and
redirects to `/auth/confirm`). `recovery` links are not accepted by this flow.

## Accepted risks — deliverable uploads

Uploads are admin-only (`requireAdminAal2`: `ADMIN_EMAILS` plus MFA AAL2). The
bucket enforces a 25 MB cap and a MIME allowlist; the actions verify the real
object metadata before a `project_files` row exists. Object keys are unique and
server-generated, and upload tokens are minted with `upsert: false`, so a reused
token cannot replace stored bytes.

- **Signed URL `download` flag is unsigned.** Storage appends `&download` outside
  the token, so a client can strip it and get inline rendering. Mitigated by the
  verified-metadata check, the strict filename/extension map, and the bucket
  MIME allowlist (no SVG/HTML), so nothing script-capable is stored.
- **Active content inside allowed types.** PDF JavaScript, CSV formulas and zip
  contents are not scanned. Deliverables are supplied by trusted admins; clients
  should treat them like any emailed attachment.
- **Legacy objects.** Objects uploaded before SVG was removed from the allowlist
  are not rewritten by the migration.
- **Company-member downloads.** Storage SELECT on `project-files` and
  `work-order-attachments` matches the table SELECT policies (owner or member of an active
  company) since `20261103000100`, so co-members can download (D2 closed); a
  suspended company's members lose the company path since `20261105000100` (D44).
- **Signed URLs issued before a suspension (accepted risk, D44).** Storage checks a
  signed URL's token, not RLS, at download time, so a URL issued while the company was
  active keeps working until it expires: project-files downloads 60s
  (`app/api/files/[id]/download`), portal ticket attachments 300s
  (`app/portal/tickets/[id]`), digital assets 600s (`lib/actions/assets.ts`). Every URL is
  signed by the cookie-bound client after an RLS-checked read, so no new URL is issued
  once the company is suspended.
