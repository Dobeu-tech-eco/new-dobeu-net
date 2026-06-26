# GitHub Copilot Instructions — Dobeu.net

> **STOP. Read `../CLAUDE.md` first.** It is the single source of truth.
> This file exists only because Copilot resolves `.github/copilot-instructions.md` by filename.
> Do not duplicate guidance here. Update `CLAUDE.md` instead.

## Pre-hook (required before any work)

```
1. Read CLAUDE.md (full file — in repo root)
2. Read .agent/HANDOFF.md (previous agent notes + outstanding items)
3. Read STATUS.md (current phase + live blockers)
4. git fetch origin && git status && git log --oneline -10
5. gh pr list --repo Dobeu-tech-eco/dobeu-net --state open
6. Catalogue available tools (see CLAUDE.md "Tool Inventory")
7. Append your session-open note to .agent/HANDOFF.md
```

## Post-hook (required before ending session)

```
1. Run checkpoint protocol (.agent/CHECKPOINT.md)
2. Append session-close note to .agent/HANDOFF.md
3. Update STATUS.md
4. Commit: "type(scope): description [checkpoint-N]"
5. Push to feature branch (NEVER main or dev directly)
```

## Sibling pointer files
- `../AGENTS.md`
- `../GEMINI.md`
- `../.cursor/rules/dobeu.mdc`
- `../codex.yaml`

## Copilot-specific notes

- Package manager: `pnpm` always (never npm or yarn)
- All mutations: Server Actions in `lib/actions/` — no client-side Supabase writes
- Never suggest `localStorage` — persistence lives in Supabase
- Always pass `--scope team_8K43hpr1Nzs0UsjjUCGh8OBK` to `vercel` CLI calls
- Supabase clients: `createClient()` for user-scoped (RLS), `createAdminClient()` for admin only
- Default theme is DARK — all suggestions must work in dark mode
- No gradients on primary UI elements — brand spec prohibits them
- No `dangerouslySetInnerHTML` for static string content — use JSX entities
- No in-memory rate limiting — use `@upstash/ratelimit` with Upstash Redis
- Run `pnpm verify` before marking any task complete

## Process Rules (owner-mandated)

1. Pre/post session hooks above are mandatory — not optional
2. Branch flow: `feature/*` → `dev` → `main`; never push directly to `dev` or `main`
3. Max 3 open branches; close duplicates before creating new ones
4. Checkpoint gate (`.agent/CHECKPOINT.md`) runs after every numbered Step
5. Multi-agent QA required before `dev → main` merge
6. New CI workflows in `.agent/workflows-pending/` — owner must install them

## Critical Blockers (as of 2026-06-19)

- `dev` branch missing — create before any code work
- Root layout: "v0 App" metadata live in production (Step 1)
- ThemeProvider + AnalyticsProvider not mounted (Step 1)
- Mobile LCP = 4.9s, Lighthouse = 78/100 (Step 2)
- Full list: `CLAUDE.md` "Known Issues & Active Blockers" (B1–B16)

## Available Tools

- **Linear MCP**: 46 tools — sprint tracking, issues
- **Composio MCP**: 7 meta-tools → GitHub, Vercel, Cloudflare, Doppler, PostHog, Slack, Figma, 100+ more
- **Stripe MCP**: 11 tools
- **gh CLI**: pre-authenticated GitHub operations
- **agent-browser skill**: Playwright, vitals, axe audits (v0 only)
- Full inventory: `CLAUDE.md` "Tool Inventory"
