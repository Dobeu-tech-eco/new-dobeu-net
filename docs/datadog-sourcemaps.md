# Datadog source maps

Without uploaded source maps, every RUM error is an unreadable minified stack.
This repo uploads them automatically on every Vercel build.

## How it works

1. `next.config.ts` sets `productionBrowserSourceMaps: true`, so `next build`
   emits `.map` files into `.next/static`.
2. `pnpm build` is `next build && node scripts/upload-sourcemaps.mjs`.
3. `scripts/upload-sourcemaps.mjs`:
   - uploads the maps with `datadog-ci sourcemaps upload` when `DATADOG_API_KEY`
     is present,
   - **always deletes every `.map` file afterwards**, so source maps are never
     served to the public even on preview deploys with no API key,
   - never fails the build — a Datadog outage must not block a deploy.

## The version contract

Datadog pairs a stack trace with a source map using three values, and **all
three must match**:

| Value | Set in RUM by | Set at upload by |
| --- | --- | --- |
| `service` | `NEXT_PUBLIC_DATADOG_SERVICE` (default `dobeu-net`) | `--service` |
| `version` | short (7 char) commit SHA in `lib/datadog.ts` | `--release-version` |
| path prefix | where Next serves the chunk | `--minified-path-prefix=/_next/static` |

Both sides derive the version from the same commit SHA
(`VERCEL_GIT_COMMIT_SHA` → first 7 characters), so they stay in lockstep with no
manual step. Override both by setting `NEXT_PUBLIC_DATADOG_VERSION`.

## Setup checklist

- [ ] `DATADOG_API_KEY` set in Vercel for **Production** (and Preview if you want
      deminified preview errors). Mark it Sensitive.
- [ ] `DATADOG_SITE` set if you are not on `datadoghq.com`.
- [ ] "Automatically expose System Environment Variables" enabled on the Vercel
      project so `VERCEL_GIT_COMMIT_SHA` exists at build time.

## Verifying

After a deploy, in Datadog: **Digital Experience → Error Tracking**, open an
issue and confirm the stack shows original file names and line numbers.

To check what was uploaded:

```bash
DATADOG_API_KEY=... pnpm exec datadog-ci sourcemaps upload .next/static \
  --service=dobeu-net --release-version=<sha7> \
  --minified-path-prefix=/_next/static --dry-run
```

## Manual run

```bash
pnpm build                # uploads + deletes as part of the build
pnpm datadog:sourcemaps   # just the upload/delete step against an existing build
```
