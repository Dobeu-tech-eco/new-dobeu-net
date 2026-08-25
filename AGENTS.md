# AGENTS.md

Guidance for Codex (and any other `AGENTS.md`-reading agent) in this repository.

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
- **Vercel env pull:** project `new-dobeu-net` on team `dobeutechnology`. With `VERCEL_TOKEN` in Cloud Agent secrets, install runs `bash scripts/pull-vercel-env.sh` to link the project and write `.env.local` (same as `vercel env pull .env.local`). Without the token, the app still serves the marketing landing; portal/admin need pulled Supabase vars.
- **GitHub (Composio):** use the **Composio dash** MCP for repo/API access — not Vercel Connect. GitHub is already connected; for `Dobeu-tech-eco/new-dobeu-net` use account `github_big-lain` (`dobeutech`) when Composio asks which GitHub account to use. Example tools: `GITHUB_GET_A_REPOSITORY`, `GITHUB_GET_REPOSITORY_CONTENT`, `GITHUB_LIST_COMMITS`.
- **In-app agent:** `lib/agent/` uses `COMPOSIO_API_KEY` + `ANTHROPIC_API_KEY` when set; run heavier jobs via `pnpm tsx scripts/agent.ts "<prompt>"`.
