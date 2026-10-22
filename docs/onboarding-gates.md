# Onboarding gates

Verified in the builder worktree on 2026-10-22 with Node 24.18.0 and pnpm 10.34.1.

## Amplitude policy

Command:

```sh
node C:/Users/JeremyWilliams/repos/_standards/checks/check-amplitude.mjs .
```

Exit code: `0`. Verdict (verbatim):

```text
RESULT: PASS
```

The checker found exactly one `initAll()` call, in `lib/analytics.ts`.

## Line endings and executable scripts

`.gitattributes` declares `* text=auto eol=lf`, forces CRLF for `*.cmd`, `*.bat`,
and `*.ps1` (so `cmd.exe` goto labels work on fresh clones), and marks image,
font, and PDF formats as binary. No repository-wide renormalization was performed.

Operator step: run `git add --renormalize .` only on a clean working tree, in a
dedicated branch, and review the resulting diff before committing it (the new CRLF
rules will rewrite existing `.cmd`/`.bat`/`.ps1` files). Renormalization remains
pending.

The existing `scripts/cloud-agent-install.sh`, `scripts/cloud-agent-start.sh`,
and `scripts/pull-vercel-env.sh` were verified as LF and explicitly preserved as
executable in the Git index with `git update-index --chmod=+x`. Their initial
mode-only worktree diffs were Windows filesystem permission artifacts; script
content was unchanged.

## Secret scanning hook

`.githooks/pre-commit` is POSIX sh, LF, and executable in Git. It runs
`gitleaks protect --staged --redact` when Gitleaks is on PATH and propagates its
exit code. Otherwise it prints a warning that the commit was not scanned and exits
successfully (fail-open). `.gitleaks.toml` extends the default rules and
allowlists only placeholder shapes (`your-...-here`, optionally prefixed `sk_test_`,
`ghp_`, `whsec_`, `re_`) inside the root `.env.example`.

Enforcement lives in CI: `.github/workflows/secret-scan.yml` runs the checksum-pinned
gitleaks 8.30.1 release binary (no `GITLEAKS_LICENSE` needed) on push and pull request
to `main`, using this repository's `.gitleaks.toml`.

Operator steps:

1. Install Gitleaks with `winget install gitleaks` or `brew install gitleaks`.
2. Enable the repository hook once per clone: `git config core.hooksPath .githooks`.

Gitleaks was absent from the builder PATH and `core.hooksPath` was unset at
inspection. Hook activation and a scan with the real Gitleaks binary remain
operator steps; the committed hook alone does not enable local scanning.

## Local validation

Validation passed before the onboarding commit:

- `pnpm type-check` and `pnpm lint`: exit `0`.
- `git check-ignore .env.example`: exit `1`; `.env.local`: exit `0`.
- POSIX shell syntax and LF checks: pass.
- Missing-Gitleaks hook path: installation hint, exit `0`.
- Shell stub for Gitleaks: received `protect --staged --redact` and propagated
  exit `23`. This checks hook control flow, not a real secret scan.
- Gitleaks TOML parses; all four shell files have Git index mode `100755`.

Next.js emitted existing CLI deprecation and inferred-workspace-root notices;
lint finished with no ESLint warnings or errors. Windows still reports mode-only
worktree differences with `core.fileMode=true`; the index retains the required
executable bits. Full `pnpm verify` remains the local merge gate after integration.
