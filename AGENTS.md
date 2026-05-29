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

| Task        | Command           |
| ----------- | ----------------- |
| Type-check  | `pnpm type-check` |
| Lint        | `pnpm lint`       |
| Build       | `pnpm build`      |
| Dev server  | `pnpm dev`        |
| Full verify | `pnpm verify`     |

### Testing

- **Unit tests**: `pnpm test:ci` runs vitest. Tests live alongside source as `*.test.ts` files in `lib/`.
- **E2E tests**: `pnpm test:e2e` runs Playwright (Chromium). Tests live in `e2e/`. Config reuses the running dev server when available (`reuseExistingServer: true`).
- **Full pre-merge check**: `pnpm verify` runs type-check + lint + test:ci + build in sequence.

### Gotchas

- **`next.config.ts` has `ignoreBuildErrors: false`** — the build fails on type errors and lint errors. Always run `pnpm type-check` and `pnpm lint` before pushing.
- **`next lint` is deprecated** in Next.js 15.5+ and will show a deprecation warning. It still works; the output is valid.
- **Supabase local stack requires Docker** — `pnpm supabase start` won't work without Docker installed. This is only needed if you're testing auth/portal/admin flows against a real database.
- **The lead API (`POST /api/lead`)** returns `{"ok":true,"lead_id":null}` when Supabase isn't configured — this is expected graceful degradation, not an error.
- **CSP headers** — when adding third-party scripts/embeds, add domains to the CSP arrays in `next.config.ts` or they'll be blocked at runtime.
- **Resend mock in tests** — `vi.fn()` mocks used as constructors (e.g. Resend) must use `function` keyword, not arrow functions. Vitest 4.x enforces this.
