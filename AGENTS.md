# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

This is a single Next.js 15 (App Router) project with three surfaces: public marketing landing (`/`), client portal (`/portal/*`), and admin panel (`/admin/*`). All share one deployment.

### Running the dev server

```bash
pnpm dev   # → http://localhost:3000
```

The marketing landing page renders fully without any external services. Portal and admin routes require Supabase auth — without it, the middleware redirects to `/login`.

### Environment variables

Copy `.env.example` → `.env.local`. All third-party integrations (Supabase, Stripe, Apollo, Resend, PostHog, etc.) are feature-flagged by the presence of their env vars and degrade gracefully when missing. The app builds and runs without any of them configured.

### Key commands (see CLAUDE.md for full list)

| Task | Command |
|------|---------|
| Type-check | `pnpm type-check` |
| Lint | `pnpm lint` |
| Build | `pnpm build` |
| Dev server | `pnpm dev` |
| Full verify | `pnpm verify` |

### Testing

- **Unit tests**: `pnpm test:ci` runs vitest. Tests live alongside source — both `lib/**/*.test.ts` and `app/api/**/route.test.ts`. `vitest.setup.ts` imports `@testing-library/jest-dom/vitest`; environment is `jsdom`; `e2e/**` is excluded.
- **E2E tests**: `pnpm test:e2e` runs Playwright (Chromium). Tests live in `e2e/`. Config reuses the running dev server when available (`reuseExistingServer: true`).
- **Full pre-merge check**: `pnpm verify` runs type-check + lint + test:ci + build in sequence.

### Embedded agent (lib/agent + scripts/agent.ts)

- The `lib/agent/` module (admin-gated via `app/api/agent/route.ts`, standalone via `pnpm tsx scripts/agent.ts "<prompt>"`) opens a Composio tool-router session and runs the Claude Agents SDK `query()`. The two SDKs are intentionally **not** in `package.json` yet — run `pnpm add @composio/core @anthropic-ai/claude-agent-sdk` to activate.
- Gated by `COMPOSIO_API_KEY` + `ANTHROPIC_API_KEY`. Without either, `runAgent()` returns `{ ok: false, error: "not_configured" }`. Without the SDKs installed, `{ ok: false, error: "sdk_not_installed" }`. Build still passes either way (`new Function("p","return import(p)")` hides the specifier from Webpack).

### Gotchas

- **`next.config.ts` has `ignoreBuildErrors: false`** — the build fails on type errors and lint errors. Always run `pnpm type-check` and `pnpm lint` before pushing.
- **`next lint` is deprecated** in Next.js 15.5+ and will show a deprecation warning. It still works; the output is valid.
- **`pnpm dev` does NOT use Turbopack** — see the comment in `components/analytics-provider.tsx`. Turbopack + Suspense streaming caused hydration mismatches in Next 15.5+ dev.
- **Supabase local stack requires Docker** — `pnpm supabase start` won't work without Docker installed. Only needed if you're testing auth/portal/admin flows against a real database.
- **Auth gating is in `middleware.ts`** (via `lib/supabase/middleware.ts`'s `updateSession`) — that's the primary `/portal` + `/admin` redirect to `/login`. Page-level `isAdminEmail` checks in `app/admin/layout.tsx` are defense-in-depth on top of that.
- **The lead API (`POST /api/lead`)** returns `{"ok":true,"lead_id":null}` when Supabase isn't configured — this is expected graceful degradation, not an error.
- **Rate limit (`lib/rate-limit.ts`)** uses Upstash REST when `UPSTASH_REDIS_REST_URL`/`TOKEN` are set, otherwise an in-process Map. The in-memory path is per-instance and not safe on serverless — set the Upstash add-on for real traffic.
- **CSP headers** — when adding third-party scripts/embeds, add domains to the CSP arrays in `next.config.ts` or they'll be blocked at runtime.
- **Vitest 4.x constructor mocks** — `vi.fn()` mocks used as constructors (e.g. `Resend`, Stripe client) must use the `function` keyword, not arrow functions.
