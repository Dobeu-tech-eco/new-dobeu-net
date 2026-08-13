# AGENTS.md

Guidance for Codex (and any other `AGENTS.md`-reading agent) in this repository.

**Canonical instructions live in [`CLAUDE.md`](./CLAUDE.md).** Read that file first and treat it as the single source of truth for architecture, commands, security notes, and workflow status.

This file is intentionally a thin pointer because some tools discover instructions by filename. Do not duplicate architectural guidance here.

Sibling pointer files:
- `GEMINI.md`
- `.github/copilot-instructions.md`

If guidance changes, update `CLAUDE.md` and keep this file minimal.

## Learned preferences

These are durable workflow preferences observed across multiple sessions. They are operational (not architectural), so they live here instead of `CLAUDE.md`.

- When the user attaches a plan file from `.cursor/plans/` and says "implement the plan as specified", do NOT edit the plan file itself; its todos are pre-created — mark them `in_progress` as you work and do not recreate them.
- Before reproposing or refreshing any plan, re-read the current codebase first (git status + diff + relevant files). The user has repeatedly corrected attempts to update a plan from prior-session memory or stale context with "review codebase and update plan accordingly".

## Cursor Cloud specific instructions

Standard lint/test/build/dev/verify commands live in `CLAUDE.md` and `package.json` — use those. Notes below are only the non-obvious cloud caveats.

Environment config is repo-managed in [`.cursor/environment.json`](./.cursor/environment.json) (Node 20 base image, `scripts/cloud-agent-install.sh`, `pnpm dev` terminal on port 3000).

- **Dependencies** are refreshed on VM startup via `./scripts/cloud-agent-install.sh` (`pnpm install --frozen-lockfile`). All gates pass clean: `pnpm type-check`, `pnpm lint`, `pnpm test:ci`, `pnpm build`.
- **Node version:** the custom Dockerfile pins Node 20 to match `engines.node`. Do not loosen `engines` — see the Node version policy in `CLAUDE.md`.
- **The app runs with no `.env.local` / no secrets.** `lib/supabase/middleware.ts` bails gracefully when Supabase env is absent, so `pnpm dev` serves the marketing landing at `/` and `POST /api/lead` returns `{ ok: true, lead_id: null }` (the `processLead` fan-out is best-effort — the Supabase insert fails silently). This is enough to demo the core lead-capture flow end-to-end. `/portal` and `/admin` redirect to `/login?error=supabase_not_configured` until real env vars exist.
- **No Docker and no `supabase/config.toml`** on the VM, so `pnpm supabase start` (local Postgres/Auth) is not available out of the box. DB-backed flows (real lead persistence, magic-link auth, portal/admin data) need real Supabase env vars.
- **Supabase env var names:** the live code reads `VERCEL_SUPABASE_URL`, `NEXT_PUBLIC_VERCEL_SUPABASE_URL`, `NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY`, `VERCEL_SUPABASE_SERVICE_ROLE_KEY` (see `lib/supabase/server.ts`). The `NEXT_PUBLIC_SUPABASE_*` names in `.env.example` are stale — don't rely on them.
- **Vercel CLI + env pull:** `vercel` is a devDependency. Add a Cloud Agent secret `VERCEL_TOKEN` (Vercel account token for team `dobeutechnology`) so install can `vercel link` project `new-dobeu-net` and `vercel env pull .env.local`. Without it, agents still run gates and the marketing demo; DB-backed flows stay blocked.
- **Vercel Connect:** `@vercel/connect` is installed; use `lib/vercel-connect.ts` (`getConnectToken`) in server code. CLI: `pnpm exec vercel connect list` / `create` / `token` — run from repo root (linked project). Requires `VERCEL_OIDC_TOKEN` (from `vercel env pull` or Vercel runtime). Register connectors in the Vercel dashboard or via `vercel connect create <service>` (may open browser for OAuth consent).
