# Security policy

Report suspected vulnerabilities privately to [jeremyw@dobeu.net](mailto:jeremyw@dobeu.net).
Include the affected version, reproduction steps, and likely impact. Do not put
credentials, personal data, or exploit details in public issues or pull requests.

## Dependency and pull request checks

Dependabot checks npm dependencies, GitHub Actions, and the Docker image in
`/containers/function` weekly. Review its security updates promptly. Cursor Bugbot
is the PR reviewer; address its security findings before merging.

GitHub Actions is currently stalled. Local `pnpm verify` is the merge gate until
Actions resumes; run the relevant Playwright and Lighthouse checks for changes
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
  are not rewritten by the migration. Company members can read `project_files`
  rows but storage SELECT is owner-only, so their download returns 500; this is a
  known deferred product item (D2).
