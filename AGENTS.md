# AGENTS.md

Repository guide for AI coding agents working on `new-dobeu-net`.

## Read first

- [`CLAUDE.md`](./CLAUDE.md) is the canonical source for architecture, security constraints, environment variables, and workflow status.
- [`BRAINSTORM.md`](./BRAINSTORM.md) and [`PLAN.md`](./PLAN.md) define product scope and accepted decisions.
- This is one Next.js application with one root `package.json`; it is not a multi-package monorepo.
- Run every command below from the repository root.

Sibling agent files:

- `GEMINI.md`
- `.github/copilot-instructions.md`
- `.codex/AGENTS.md` — Codex CLI and ECC baseline
- `.codex/autonomous-loop.md` — autonomous-loop protocol

## Setup and run

Requirements: Node 24 (`.nvmrc`; `package.json` requires `>=24`) and pnpm 10.34.1.

| Task                                                | Command                          |
| --------------------------------------------------- | -------------------------------- |
| Enable the pinned package manager when needed       | `corepack enable`                |
| Install exactly from the lockfile                   | `pnpm install --frozen-lockfile` |
| Install after intentionally changing dependencies   | `pnpm install`                   |
| Create an optional local environment file           | `cp .env.example .env.local`     |
| Start development server on `http://localhost:3000` | `pnpm dev`                       |
| Create a production build                           | `pnpm build`                     |
| Start the production build                          | `pnpm start`                     |
| Build and fail on selected Next.js warnings         | `pnpm build:strict`              |

The public site and lead-form demo run without `.env.local`. `/portal` and `/admin` require Supabase configuration and otherwise redirect to `/login?error=supabase_not_configured`.

## Tests

| Task                                         | Command                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| Vitest watch mode                            | `pnpm test`                                                                  |
| All unit/component tests once                | `pnpm test:ci`                                                               |
| One Vitest file                              | `pnpm test:ci lib/leads.test.ts`                                             |
| Tests matching a name in one file            | `pnpm test:ci lib/leads.test.ts -t "Supabase failures"`                      |
| Coverage report                              | `pnpm test:coverage`                                                         |
| Install the CI Playwright browser            | `pnpm exec playwright install --with-deps chromium`                          |
| All Playwright tests                         | `pnpm test:e2e`                                                              |
| One Playwright spec/project                  | `pnpm test:e2e e2e/smoke.spec.ts --project=chromium`                         |
| One Playwright test by name                  | `pnpm test:e2e e2e/smoke.spec.ts --project=chromium --grep "homepage loads"` |
| Playwright UI mode                           | `pnpm test:e2e:ui`                                                           |
| Mobile Lighthouse checks for `/` and `/labs` | `pnpm lighthouse:ci`                                                         |

- Vitest includes `*.test.ts(x)` and `*.spec.ts(x)` outside `e2e/`.
- Playwright specs live in `e2e/`; its config starts `pnpm dev` automatically.
- For `lib/actions/*.test.ts`, use `buildStubClient()` from `lib/actions/__test-helpers.ts` instead of mocking Supabase modules.
- Pass test filters directly after the script name. Do not add an extra `--`; it prevents the current Vitest/Playwright commands from filtering as intended.

## Before committing

| Task                           | Command           |
| ------------------------------ | ----------------- |
| Format the repository in place | `pnpm format`     |
| Lint                           | `pnpm lint`       |
| Autofix lint findings          | `pnpm lint:fix`   |
| Type-check                     | `pnpm type-check` |
| Full local merge gate          | `pnpm verify`     |

`pnpm verify` runs type-check, lint, one-shot Vitest, and the strict production build. Review the diff after `pnpm format` because it writes the whole repository.

## Pull requests

- Branches: no branch-name pattern is enforced. Use a short, descriptive name; when a task prescribes one, use it exactly.
- Protected history: change `main` through a PR; do not force-push or delete it. Keep history linear.
- Commits: use Conventional Commits — `<type>(<optional-scope>): <imperative summary>`.
  - Examples: `feat(offerings): add entry ladder`, `fix(ci): regenerate visual baselines`, `chore: update agent guidance`.
- Keep each PR focused and add or update tests for behavioral changes.
- Run `pnpm verify` before requesting review.

PR workflows to keep green:

| Check              | Source                                     | What it runs                              |
| ------------------ | ------------------------------------------ | ----------------------------------------- |
| Verify             | `.github/workflows/ci.yml`                 | install, `pnpm verify`, coverage report   |
| E2E                | `.github/workflows/ci.yml`                 | Chromium install and `pnpm test:e2e`      |
| Lighthouse         | `.github/workflows/ci.yml`                 | `pnpm build` and `pnpm lighthouse:ci`     |
| Build & smoke test | `.github/workflows/oci-function-build.yml` | only for `containers/function/**` changes |

Coverage and dependency audit currently report results but do not enforce thresholds. GitHub currently has no required-status-check contexts configured; agents should still treat Verify, E2E, Lighthouse, and any path-specific OCI check as merge gates.

## Key directories

| Path                   | Purpose                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `app/`                 | Next.js App Router pages, layouts, route handlers, public site, portal, and admin surfaces |
| `components/`          | Shared React UI; landing, portal, admin, brand, and shadcn primitives                      |
| `lib/`                 | Domain logic, integrations, Supabase clients, analytics, and server actions                |
| `hooks/`               | Shared client hooks                                                                        |
| `e2e/`                 | Playwright smoke, authenticated-flow, and visual-regression tests                          |
| `supabase/migrations/` | Ordered, additive database migrations                                                      |
| `containers/function/` | Separate OCI container service, Dockerfile, server, and tests                              |
| `scripts/`             | Build, deployment, environment, agent, and operator utilities                              |
| `public/`              | Static assets and crawler/AI metadata                                                      |
| `docs/`                | Deployment, observability, reviews, audits, and implementation plans                       |
| `types/`               | Project-wide TypeScript declarations                                                       |
| `.github/workflows/`   | CI, review, dependency-audit, OCI, and snapshot workflows                                  |

`lib/database.types.ts` is generated. Regenerate it with `pnpm db:types`; do not edit it by hand.

## Environment notes

- Local Supabase is not available from this checkout without Docker and a `supabase/config.toml`. Database-backed flows need real Supabase variables.
- Live Supabase code uses `VERCEL_SUPABASE_URL`, `NEXT_PUBLIC_VERCEL_SUPABASE_URL`, `NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY`, and `VERCEL_SUPABASE_SERVICE_ROLE_KEY`.
- Pull Vercel-managed values with `vercel env pull .env.local`; cloud setup may run `bash scripts/pull-vercel-env.sh` when `VERCEL_TOKEN` is available.
- For GitHub repository/API access, use the connected Composio GitHub account `github_big-lain` (`dobeutech`) for `Dobeu-tech-eco/new-dobeu-net`.
- `lib/agent/` uses `COMPOSIO_API_KEY` and `ANTHROPIC_API_KEY`. Its standalone `scripts/agent.ts` entry point also needs the optional agent SDK packages and a TypeScript runner; those are not installed by the current `package.json`.

## Learned workflow preferences

- When the user attaches a plan from `.cursor/plans/` and says to implement it as specified, do not edit or recreate the plan. Mark its existing todos `in_progress` as work proceeds.
- Before proposing or refreshing a plan, re-read the current codebase: check git status, the diff, and the relevant files. Do not plan from stale session context.
- Preserve unrelated working-tree changes. Do not clean up scratch files or untracked content without confirming ownership and intent.
