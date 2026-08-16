# AGENTS.md - Full Autonomous Loop Protocol (Grok Build + MCP)
# Single-command end-to-end: prompt → Vercel prod-ready PR (preview only)

## Orchestration Rules (agent-organizer enforces)
1. ALWAYS start with: 
   START_NOTE: [task summary | previous outputs | repo state | MCP tools available]
2. Spawn subagents in strict order (parallel where safe):
   - general-purpose/explore/plan
   - architect/backend-architect/fullstack-architect
   - frontend-developer/react-pro/typescript-pro
   - code-reviewer/security-reviewer/qa-expert/tdd-guide/unit-test-generator/e2e-runner
   - ci-cd-generator/deployment-engineer/docker-specialist/database-migrator/infrastructure-engineer
3. 7 MANDATORY CHECKPOINTS (each with git commit to worktree + summary):
   - Checkpoint 1: Plan complete
   - Checkpoint 2: Code generated (fullstack Vercel-ready)
   - Checkpoint 3: Tests + E2E (Vitest/Playwright)
   - Checkpoint 4: Security review (Sentinel-style)
   - Checkpoint 5: Optimization + refactor
   - Checkpoint 6: Docker + local validation
   - Checkpoint 7: Vercel preview deploy + final PR
4. END_NOTE: [artifacts | Vercel preview URL | GH PR link | confidence % | human merge required for prod]
5. Worktree isolation on all subagents. No main-branch writes until final PR.
6. Logging: Every checkpoint writes to Supabase agent_tasks table (if connected).

Use this for ANY full-stack repo. Run with: grok <feature prompt> --autonomous

---

**Canonical instructions live in [`CLAUDE.md`](./CLAUDE.md).** Read that file first and treat it as the single source of truth for architecture, commands, security notes, and workflow status.

This file is intentionally a thin pointer because some tools discover instructions by filename. Do not duplicate architectural guidance here.

Sibling pointer files:
- `GEMINI.md`
- `.github/copilot-instructions.md`
- `.codex/AGENTS.md` — Codex CLI baseline and ECC tooling
- `.codex/autonomous-loop.md` — full autonomous loop protocol (Grok Build + MCP)

If guidance changes, update `CLAUDE.md` and keep this file minimal.

## Learned preferences

These are durable workflow preferences observed across multiple sessions. They are operational (not architectural), so they live here instead of `CLAUDE.md`.

- When the user attaches a plan file from `.cursor/plans/` and says "implement the plan as specified", do NOT edit the plan file itself; its todos are pre-created — mark them `in_progress` as you work and do not recreate them.
- Before reproposing or refreshing any plan, re-read the current codebase first (git status + diff + relevant files). The user has repeatedly corrected attempts to update a plan from prior-session memory or stale context with "review codebase and update plan accordingly".

## Cursor Cloud specific instructions

Standard lint/test/build/dev/verify commands live in `CLAUDE.md` and `package.json` — use those. Notes below are only the non-obvious cloud caveats.

- **Dependencies** are refreshed automatically on VM startup (`pnpm install --frozen-lockfile`). All five gates pass clean: `pnpm type-check`, `pnpm lint`, `pnpm test:ci` (280 tests), `pnpm build`.
- **Node version:** the VM ships Node 22 while `engines.node` pins `20.x`. pnpm prints a harmless `Unsupported engine` warning; every gate and the dev server still pass. Do not "fix" this by editing `engines` — see the Node version policy in `CLAUDE.md`.
- **The app runs with no `.env.local` / no secrets.** `lib/supabase/middleware.ts` bails gracefully when Supabase env is absent, so `pnpm dev` serves the marketing landing at `/` and `POST /api/lead` returns `{ ok: true, lead_id: null }` (the `processLead` fan-out is best-effort — the Supabase insert fails silently). This is enough to demo the core lead-capture flow end-to-end. `/portal` and `/admin` redirect to `/login?error=supabase_not_configured` until real env vars exist.
- **No Docker and no `supabase/config.toml`** on the VM, so `pnpm supabase start` (local Postgres/Auth) is not available out of the box. DB-backed flows (real lead persistence, magic-link auth, portal/admin data) need real Supabase env vars.
- **Supabase env var names:** the live code reads `VERCEL_SUPABASE_URL`, `NEXT_PUBLIC_VERCEL_SUPABASE_URL`, `NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY`, `VERCEL_SUPABASE_SERVICE_ROLE_KEY` (see `lib/supabase/server.ts`). The `NEXT_PUBLIC_SUPABASE_*` names in `.env.example` are stale — don't rely on them.
- **Vercel:** this repo is linked to project `new-dobeu-net` (team `dobeutechnology`) via a local, gitignored `.vercel/project.json`. To populate `.env.local` with real secrets run `vercel env pull .env.local`, which requires Vercel auth (`VERCEL_TOKEN` secret or `vercel login`). The Vercel CLI is installed to `~/.local/bin` by `scripts/cloud-agent-install.sh`.
- **Vercel Connect:** Cloud Agent install links the Vercel project and pulls env vars when `VERCEL_TOKEN` is set. To create a GitHub connector for repo/API access, run `vercel connect create github` from `/workspace` (requires browser OAuth). List connectors with `vercel connect list`; get tokens with `vercel connect token <connector> --subject app`.
