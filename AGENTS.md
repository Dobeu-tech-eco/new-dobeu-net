# AGENTS.md

Quick reference for AI agents working in this repository. Read [`CLAUDE.md`](./CLAUDE.md) first; it remains the source of truth for architecture, security constraints, environment variables, and workflow status.

## Repository shape

- Single Next.js 15 App Router application; this is **not a monorepo**.
- `pnpm-workspace.yaml` only configures allowed dependency builds and security overrides.
- Runtime: Node 24 (`.nvmrc`, `package.json#engines`).
- Package manager: pnpm 10.34.1 (`package.json#packageManager`).

## Setup and run

```bash
pnpm install --frozen-lockfile  # install exactly from pnpm-lock.yaml
pnpm dev                        # development server at http://localhost:3000
pnpm build                      # production Next.js build + Datadog source-map step
pnpm start                      # serve an existing production build
pnpm build:strict               # build and fail on selected Next.js warnings
```

The marketing site and non-secret-dependent tests work without `.env.local`. Supabase-backed portal/admin flows require the environment variables documented in `CLAUDE.md`.

## Tests

### Vitest

Tests are colocated under `app/`, `components/`, `containers/`, `hooks/`, and `lib/` as `*.test.ts(x)` or `*.spec.ts(x)`.

```bash
pnpm test                                      # watch mode
pnpm test:ci                                   # all tests, one run
pnpm test:coverage                             # one run + text/lcov coverage
pnpm test:ci lib/leads.test.ts                  # one test file
pnpm test:ci -t "processLead"                   # tests matching a name
pnpm test:ci containers/function/path.test.ts
```

For `lib/actions/*.test.ts`, use `buildStubClient()` from `lib/actions/__test-helpers.ts`; do not mock the Supabase module directly.

### Playwright

`playwright.config.ts` starts `pnpm dev` automatically and runs desktop Chromium plus mobile Chrome projects.

```bash
pnpm test:e2e
pnpm test:e2e:ui
pnpm exec playwright test e2e/smoke.spec.ts
pnpm exec playwright test e2e/smoke.spec.ts --grep "homepage loads with outcome hero"
pnpm exec playwright test --project=chromium
```

`e2e/tickets.spec.ts` skips its authenticated portal flow unless the required Supabase E2E variables are present.

## Lint, format, and verification

```bash
pnpm lint        # Next.js ESLint rules
pnpm lint:fix    # ESLint autofix
pnpm format      # Prettier write across the repository
pnpm type-check  # TypeScript without emit
pnpm verify      # type-check + lint + test:ci + build:strict
```

- Run `pnpm lint`, `pnpm type-check`, and relevant tests before committing.
- Run `pnpm verify` before opening or merging a PR.
- Run `pnpm format` when files need formatting; it rewrites matching files rather than checking only.

## Pull requests

### Branches and commits

- Base normal changes on `main`.
- No automated branch-naming rule is configured. Prefer `<type>/<short-kebab-case>`, for example `feat/typeform-estimate-pipeline`, `fix/mobile-nav`, or `chore/dependency-audit`.
- Use Conventional Commits: `<type>(optional-scope): <imperative summary>`.
- Common repository types include `feat`, `fix`, `chore`, and `ci`.
- Keep the first line concise; example: `fix(ci): restore visual snapshot baselines`.
- `main` requires linear history. Rebase or squash; do not introduce merge commits.

### Merge gates

Treat these GitHub PR jobs as required before merge:

| Check                | What it runs                                                                   |
| -------------------- | ------------------------------------------------------------------------------ |
| `Verify`             | Frozen install, then `pnpm verify`; coverage is uploaded but has no threshold. |
| `E2E`                | Installs Chromium and runs `pnpm test:e2e`.                                    |
| `Lighthouse`         | Runs `pnpm build` and `pnpm lighthouse:ci`.                                    |
| `Build & smoke test` | Additional path-filtered check for changes under `containers/function/**`.     |

`Dependency audit / pnpm audit` is report-only (`continue-on-error`). GitHub branch protection currently exposes no required status-check contexts, so agents must still use the workflow results above as the merge gates.

## Key directories

| Path                   | Purpose                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `app/`                 | App Router pages, layouts, route handlers, marketing pages, portal, and admin surfaces. |
| `components/`          | Shared UI; `landing/`, `portal/`, `admin/`, `brand/`, and shadcn primitives in `ui/`.   |
| `lib/`                 | Domain logic, integrations, analytics, Supabase clients, and shared helpers.            |
| `lib/actions/`         | Authenticated server actions and their colocated tests/test helpers.                    |
| `hooks/`               | Client React hooks and hook tests.                                                      |
| `e2e/`                 | Playwright smoke, portal-flow, and visual tests.                                        |
| `containers/function/` | Separate OCI HTTP service, Dockerfile, and path-routing tests.                          |
| `supabase/migrations/` | Ordered, additive database migrations and RLS policies.                                 |
| `public/`              | Static assets and public metadata.                                                      |
| `scripts/`             | Strict build, source-map upload, agent, environment, and operator scripts.              |
| `docs/`                | Deployment, observability, tracking, audits, plans, and verification notes.             |
| `.github/workflows/`   | CI, E2E/Lighthouse, dependency audit, OCI, and snapshot workflows.                      |
| `.ona/`                | Ona tasks and development-service configuration.                                        |

## High-value repository rules

- Read `BRAINSTORM.md` and `PLAN.md` before changing product scope; use `STATUS.md` for shipped phase status.
- Do not add `next.config.js`; `next.config.ts` is the only Next configuration.
- Never hand-edit `lib/database.types.ts`; regenerate it with `pnpm db:types` after schema changes.
- Keep migrations ordered and additive.
- Validate API inputs with Zod.
- Use the `@/*` path alias for root-relative imports.
- Keep heavy embeds behind `next/dynamic`.
- When adding third-party browser resources, update the CSP in `next.config.ts`.

## Learned agent preferences

- When the user attaches a plan from `.cursor/plans/` and says to implement it, do not edit the plan file or recreate its todos; mark the existing todos `in_progress` as work proceeds.
- Before reproposing or refreshing a plan, reread `git status`, the current diff, and the relevant source files.
- Preserve unrelated working-tree changes. Do not clean up `.reports/`, `_tmp_16_<hash>`, new `.jules/*.md`, or untracked operator scripts without confirming ownership.

## Cloud environment notes

- Startup installs dependencies with `pnpm install --frozen-lockfile`.
- The cloud environment and repository both use Node 24; do not change the Node policy casually. Update `package.json`, `.nvmrc`, and CI together when a deliberate major upgrade is required.
- The app runs without `.env.local`: `/` works, while `/portal` and `/admin` redirect to `/login?error=supabase_not_configured`.
- Local Supabase is unavailable without Docker and `supabase/config.toml`; remote Supabase variables are required for DB-backed flows.
- Live Supabase names are `VERCEL_SUPABASE_URL`, `NEXT_PUBLIC_VERCEL_SUPABASE_URL`, `NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY`, and `VERCEL_SUPABASE_SERVICE_ROLE_KEY`.
- `scripts/pull-vercel-env.sh` links Vercel project `new-dobeu-net` on team `dobeutechnology` and writes `.env.local` when `VERCEL_TOKEN` is available.
- For GitHub API access to `Dobeu-tech-eco/new-dobeu-net`, use the connected Composio GitHub account `github_big-lain` (`dobeutech`).
- `lib/agent/` needs `COMPOSIO_API_KEY` and `ANTHROPIC_API_KEY`; without its optional keys or SDK packages, the agent surface degrades gracefully.

## Related agent files

- `GEMINI.md`
- `.github/copilot-instructions.md`
- `.codex/AGENTS.md`
- `.codex/autonomous-loop.md`
