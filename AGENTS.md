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

## Cursor Cloud specific instructions

Standard commands live in `CLAUDE.md` (`pnpm dev`, `pnpm lint`, `pnpm type-check`, `pnpm test:ci`, `pnpm build`). The notes below are cloud-only caveats discovered while setting up the VM; they are not in `CLAUDE.md`.

- **The dev server boots with zero env vars.** `pnpm dev` serves the marketing landing at `/` and `POST /api/lead` returns `{ ok: true, lead_id: null }` (the Supabase/Apollo/Resend fan-out is best-effort and fails silently when unconfigured). This is the runnable scope without secrets. `/portal` and `/admin` redirect to `/login?error=supabase_not_configured` until real Supabase env exists.
- **Use `pnpm build`, not `pnpm build:strict` / `pnpm verify`, to verify the build in the cloud.** The VM runs Node 22 while `engines.node` pins `20.x`, producing a harmless `Unsupported engine` warning. `scripts/strict-build.mjs` (used by `build:strict` and `verify`) treats the `Detected "engines"` warning as fatal, so it fails on this VM for an environment-only reason. Plain `pnpm build` (what Vercel runs) is lenient and is the correct verifier here.
- **Full end-to-end testing (auth, portal, admin, real lead persistence) needs secrets that are not present by default.** Live code reads `VERCEL_SUPABASE_URL`, `NEXT_PUBLIC_VERCEL_SUPABASE_URL`, `NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY`, `VERCEL_SUPABASE_SERVICE_ROLE_KEY`, and `ADMIN_EMAILS` (the `NEXT_PUBLIC_SUPABASE_*` names in `.env.example`/README are stale — don't use them). Provide these as Secrets, or run `vercel env pull .env.local`, which requires a `VERCEL_TOKEN` (interactive `vercel login` does not work in the cloud VM, and the repo is not pre-linked — no `.vercel/` dir).
- **No Docker / local Supabase on the VM**, so `pnpm supabase start` and `pnpm db:types` won't work; point at a remote Supabase project instead.
- Admin pages additionally require MFA/AAL2 even after the `ADMIN_EMAILS` gate, so admin E2E needs an enrolled account.

## Cursor Cloud specific instructions

Standard lint/test/build/dev/verify commands live in `CLAUDE.md` and `package.json` — use those. Notes below are only the non-obvious cloud caveats.

- **Dependencies** are refreshed automatically on VM startup (`pnpm install --frozen-lockfile`). All five gates pass clean: `pnpm type-check`, `pnpm lint`, `pnpm test:ci` (280 tests), `pnpm build`.
- **Node version:** the VM ships Node 22 while `engines.node` pins `20.x`. pnpm prints a harmless `Unsupported engine` warning; every gate and the dev server still pass. Do not "fix" this by editing `engines` — see the Node version policy in `CLAUDE.md`.
- **The app runs with no `.env.local` / no secrets.** `lib/supabase/middleware.ts` bails gracefully when Supabase env is absent, so `pnpm dev` serves the marketing landing at `/` and `POST /api/lead` returns `{ ok: true, lead_id: null }` (the `processLead` fan-out is best-effort — the Supabase insert fails silently). This is enough to demo the core lead-capture flow end-to-end. `/portal` and `/admin` redirect to `/login?error=supabase_not_configured` until real env vars exist.
- **No Docker and no `supabase/config.toml`** on the VM, so `pnpm supabase start` (local Postgres/Auth) is not available out of the box. DB-backed flows (real lead persistence, magic-link auth, portal/admin data) need real Supabase env vars.
- **Supabase env var names:** the live code reads `VERCEL_SUPABASE_URL`, `NEXT_PUBLIC_VERCEL_SUPABASE_URL`, `NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY`, `VERCEL_SUPABASE_SERVICE_ROLE_KEY` (see `lib/supabase/server.ts`). The `NEXT_PUBLIC_SUPABASE_*` names in `.env.example` are stale — don't rely on them.
- **Vercel:** this repo is linked to project `new-dobeu-net` (team `dobeutechnology`) via a local, gitignored `.vercel/project.json`. To populate `.env.local` with real secrets run `vercel env pull .env.local`, which requires Vercel auth (`VERCEL_TOKEN` secret or `vercel login`). The Vercel CLI is not a repo dependency and is not auto-installed.
