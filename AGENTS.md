# AGENTS.md

Guidance for Codex (and any other `AGENTS.md`-reading agent) in this repository.

**Canonical instructions live in [`CLAUDE.md`](./CLAUDE.md).** Read that file first and treat it as the single source of truth for architecture, commands, security notes, and workflow status.

This file is intentionally a thin pointer because some tools discover instructions by filename. Do not duplicate architectural guidance here.

Sibling pointer files:
- `GEMINI.md`
- `.github/copilot-instructions.md`

If guidance changes, update `CLAUDE.md` and keep this file minimal.

## Cursor Cloud specific instructions

Non-obvious caveats for running this repo in a Cursor Cloud VM. Standard commands live in `CLAUDE.md` / `README.md` — only the gotchas are repeated here.

- **Node 20 is required for `pnpm verify` / `pnpm build:strict`.** The VM default `node` is v22 (`/exec-daemon/node`, wins on `PATH`), but `engines.node` is pinned to `20.x` and `scripts/strict-build.mjs` fails on the `Detected "engines"` warning that Next.js emits on a mismatched Node. nvm has 20 installed — activate it for the whole shell with `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"` (plain `nvm use 20` does NOT win because `/exec-daemon` precedes nvm on `PATH`). Lint, type-check, tests, and plain `pnpm dev`/`pnpm build` work on either Node version.
- **Supabase env var names differ from `.env.example`.** The runtime reads `NEXT_PUBLIC_VERCEL_SUPABASE_URL`, `NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY`, `VERCEL_SUPABASE_URL`, and `VERCEL_SUPABASE_SERVICE_ROLE_KEY` (see `lib/supabase/{client,server,middleware}.ts`). `.env.example` is stale (`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`) — those names are ignored. Put the `VERCEL_`-prefixed names in `.env.local`.
- **Local Supabase needs Docker, which is not preinstalled.** Install Docker, start the daemon (`sudo dockerd &`), make the socket usable (`sudo chmod 666 /var/run/docker.sock`), then `pnpm supabase start`. `supabase start` auto-applies every migration in `supabase/migrations/`. The modern CLI prints new-style keys (`sb_publishable_…` / `sb_secret_…`) — use them directly as the anon / service-role values; `@supabase/ssr` accepts them.
- **The app runs fine with NO env at all** (landing page, build) because the Supabase clients fall back to placeholders and most provider integrations are presence-flagged; you only need `.env.local` to exercise lead capture, auth, portal, and admin.
- **Restart `pnpm dev` after creating/editing `.env.local`** — it only reads env on boot.
- Fastest end-to-end smoke of core functionality: `POST /api/lead` (public landing form) persists a row to `public.leads` via the service-role client — verify with `docker exec supabase_db_workspace psql -U postgres -d postgres -c "select email,source from public.leads;"`.

## Learned preferences

These are durable workflow preferences observed across multiple sessions. They are operational (not architectural), so they live here instead of `CLAUDE.md`.

- When the user attaches a plan file from `.cursor/plans/` and says "implement the plan as specified", do NOT edit the plan file itself; its todos are pre-created — mark them `in_progress` as you work and do not recreate them.
- Before reproposing or refreshing any plan, re-read the current codebase first (git status + diff + relevant files). The user has repeatedly corrected attempts to update a plan from prior-session memory or stale context with "review codebase and update plan accordingly".
