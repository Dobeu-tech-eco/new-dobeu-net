# Vercel platform optimization review

Review date: 2026-06-18  
Branch: `cc-dev/vercel-platform-optimization-review-0c98`  
Source workflow run: success at `02559bbdce53d67ce35d656632148a80e888de52`

## Scope

This review covers the requested `/deployments-cicd`, `/vercel-agent`, `/vercel-cli`, `/nextjs`,
`/marketplace`, `/ai-sdk`, `/vercel-storage`, and `/workflow` passes for the current Next.js 15
Vercel app.

## Findings and signoffs

### Deployments and CI/CD

- **Status:** OK.
- `.github/workflows/ci.yml` installs with pnpm and runs `pnpm verify`.
- `pnpm verify` currently runs type-check, lint, Vitest, and the strict build wrapper.
- `vercel.json` uses the Next.js framework preset, `pnpm install --frozen-lockfile`, and
  `pnpm build` for Vercel deploys. The stricter warning gate stays in CI through
  `scripts/strict-build.mjs`, while Vercel production builds remain tolerant of unrelated future
  warnings.
- The cloud checkout does not include `.vercel/project.json`, so CLI project-scoped operations
  such as `vercel integration add` should not run until the operator confirms the intended
  Vercel team/project.

### Vercel Agent and CLI guidance

- **Status:** fixed guidance.
- Vercel MCP tools were available for documentation lookup during this review.
- `CLAUDE.md` now explicitly instructs agents to inspect MCP tools first for Vercel tasks, use
  Vercel documentation tools before relying on memory, and avoid blindly running
  `vercel agent init` because this repository intentionally keeps `AGENTS.md`, `GEMINI.md`, and
  `.github/copilot-instructions.md` as thin pointers to `CLAUDE.md`.

### Next.js review

- **Status:** OK.
- Source scan found no Pages Router data APIs (`getServerSideProps`, `getStaticProps`), no
  `next/router`, no `next/head`, and no Pages API handler types.
- The app uses App Router conventions and `next/font`.
- Root `middleware.ts` is still correct for Next.js 15. Do not rename to `proxy.ts` until a
  deliberate Next.js 16 migration.
- `next.config.ts` keeps type and lint build failures enabled and uses explicit CSP host lists for
  analytics, embeds, and support tooling.

### Marketplace integration opportunities

- **Already used / wired:** Supabase Marketplace envs, Upstash Redis for `/api/lead` rate limiting,
  Vercel Analytics, Speed Insights, Datadog browser observability, Intercom, Stripe, and Resend.
- **Recommended next opportunities:**
  1. Install or verify the Datadog Marketplace integration if server logs/traces should flow through
     Vercel Drains. The browser SDK is already present, but Marketplace drains cover platform logs
     and traces.
  2. Use Vercel Blob for future `project_files` uploads/downloads if file storage moves beyond
     Supabase Storage or needs simpler signed upload flows.
  3. Use Edge Config for maintenance mode, feature flags, or marketing/admin experiment toggles
     that need instant reads without redeploying.
  4. Consider Checkly or Sentry Marketplace integrations for external uptime checks and issue
     tracking if Datadog is not the only production monitoring surface.

### AI SDK signoff

- **Status:** OK / no code changes required.
- Source scan found no direct OpenAI/Anthropic SDK imports and no stale AI SDK v5/v6 migration
  patterns.
- If this app later adds AI chat, agentic admin workflows, or content generation, prefer Vercel AI
  SDK with AI Gateway model strings for routing, failover, and cost visibility.

### Vercel Storage review

- **Status:** OK.
- Source scan found no sunset `@vercel/kv` or `@vercel/postgres` usage.
- Supabase remains the primary database/auth/storage provider by design.
- Upstash Redis is already used for production lead rate limiting when its REST env vars are
  present, with a local in-memory fallback.

### Workflow review

- **Status:** opportunity only.
- Source scan found no Workflow DevKit code.
- Vercel Workflow would be a good fit if lead capture, booking sync, invoice issuance, or future
  work-order fulfillment becomes long-running, retry-heavy, or human-approval-driven. The current
  `processLead()` best-effort fan-out is short enough to keep as a route-handler call path for now.

## Change summary

- Corrected stale package-manager and verify-command guidance in `CLAUDE.md`.
- Corrected `/api/lead` rate-limit documentation to reflect the current Upstash-backed production
  path.
- Documented an MCP-first Vercel platform review workflow for future agents.
- Updated README environment notes for Vercel Analytics/Speed Insights and Upstash Redis.
