# Lighthouse verification — `/` (2026-10-22)

Scope: harness run `20261022-004253`, builder 5 (S18). Goal: Performance >= 90,
Accessibility >= 95, Best Practices >= 90, SEO >= 95 on `/`, mobile and desktop,
with no copy, layout, or brand changes.

## Result

| `/` (median) | Perf | A11y | Best Practices | SEO | FCP | LCP | TBT | CLS | SI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mobile, baseline `a3ddc07` | **74** | 100 | 100 | 100 | 1.23 s | 3.45 s | 726 ms | 0 | 1.88 s |
| Mobile, final | **86** | 100 | 100 | 100 | 1.23 s | 3.09 s | 334 ms | 0 | 1.79 s |
| Desktop, baseline `a3ddc07` | 99 | 100 | 100 | 100 | 0.35 s | 0.85 s | 10 ms | 0 | 0.82 s |
| Desktop, final | 99 | 100 | 100 | 100 | 0.34 s | 0.86 s | 11 ms | 0 | 0.76 s |

Mobile: median of 5 interleaved runs. Desktop: median of 3 interleaved runs.

**Mobile Performance did not reach 90.** The final per-run scores were 83, 87, 82,
90, and 86. Desktop and the other three categories meet the target on both form
factors. See "What is left" below.

First Load JS for `/`: **165 kB -> 127 kB**. `/labs` also drops from 160 kB to 127 kB,
because it shares the nav and lightbox.

### Raw runs

Each run's `benchmarkIndex` (bi) is listed because the host was busy, with about 35–50%
CPU load from other processes. That noise mostly hits TBT, so baseline and final runs were
interleaved. Each pair ran under the same load.

```
base  mobile  74/100/100/100 tbt 726  lcp 3417 bi 2082
base  mobile  60/100/100/100 tbt 1868 lcp 3991 bi 1679
base  mobile  69/100/100/100 tbt 885  lcp 3736 bi 2140
base  mobile  78/100/100/100 tbt 536  lcp 3426 bi 2118
base  mobile  79/100/100/100 tbt 470  lcp 3446 bi 2072
final mobile  83/100/100/100 tbt 452  lcp 3063 bi 2058
final mobile  87/100/100/100 tbt 307  lcp 3093 bi 2215
final mobile  82/100/100/100 tbt 446  lcp 3174 bi 2102
final mobile  90/100/100/100 tbt 232  lcp 3059 bi 2161
final mobile  86/100/100/100 tbt 334  lcp 3134 bi 2193
base  desktop 99/100/100/100 (x3)
final desktop 99/100/100/100 (x3)
```

`/labs` final, for the shared lighthouserc assertions: mobile 70 / 88 / 89 (perf),
desktop 99 / 100 / 99. A11y, Best Practices, and SEO were 100 on every run.

## Method

- Build: `pnpm build`. `scripts/upload-sourcemaps.mjs` is non-fatal without
  `DATADOG_API_KEY`: it skipped the upload and deleted the maps. The baseline was built
  from `git archive a3ddc07` in a scratch directory using `next build` plus the same
  sourcemap script, so both builds ship identical artifacts.
- Serve: `next start -p 3105` (final) and `-p 3106` (baseline), side by side.
- Measure: Lighthouse 12.1.0 CLI (the version `@lhci/cli` 0.14 bundles). Headless
  Chrome, simulated throttling, one discarded warm-up run per server.
  - Mobile: `--formFactor=mobile --screenEmulation.width=412 --screenEmulation.height=823 --screenEmulation.deviceScaleFactor=2.625` (same as `lighthouserc.cjs`).
  - Desktop: `--preset=desktop` (same as `lighthouserc.desktop.cjs`).
- Both servers were stopped afterwards.
- Known tooling noise: Lighthouse 12.1 against the installed Chrome logs an error in the
  `TraceElements` gatherer, so the "LCP element" audit is blank. Scores are unaffected. The
  LCP element is `h1#hero-heading` (from the trace).

## What changed (no visual change)

| Change | Why |
| --- | --- |
| `LightboxProvider` loads the dialog (`LightboxDialog.tsx`) with `next/dynamic` on first open | Radix Dialog (focus scope, scroll lock, aria-hidden) was hydrated on every page load for a dialog that starts closed |
| Nav theme toggle is a same-markup placeholder (`NavThemeToggle.tsx`) that mounts the real `ThemeToggle` on first hover, focus, or press. A press before load is replayed. | Radix DropdownMenu + Popper (~100 kB raw) was in the critical bundle for a closed menu |
| `Hero`, the `OperationsHome` sections, and `SiteFooter` are Server Components. Their CTAs moved into small client islands (`LandingCtas.tsx`, `CookiePreferencesButton.tsx`). | Static sections no longer ship component JS |
| Sonner `<Toaster />` is mounted via `DeferredToaster` after the first interaction on marketing routes. It stays eager on `/login`, `/auth`, `/portal`, `/admin`, and `/company`. | Toasts on marketing pages always follow a user action. App routes can toast on mount. |
| `StickyMobileCTA` is imported through a client `next/dynamic` slot | It was bundled on every `MarketingShell` page even though no page passes `stickyCta` |
| Legal page titles no longer repeat the brand (`Privacy Policy · Dobeu Tech Solutions` instead of `Privacy Policy — Dobeu Tech Solutions · Dobeu Tech Solutions`) | Metadata only. The layout title template already adds the suffix. |
| `lighthouserc.cjs` asserts all four categories. New `lighthouserc.desktop.cjs` uses the desktop preset with the same thresholds. | Gate parity with CLAUDE.md quality targets |

### Visual-equivalence evidence

The server-rendered HTML of `/` and `/labs` was diffed between baseline and final, with
scripts, links, the RSC payload, and Radix ids stripped. The rendered markup is the same
except for:

1. The theme toggle placeholder sits in a `display: contents` span, which adds no box and
   leaves the flex layout unchanged. The button classes, `aria-label`, `aria-haspopup`,
   `aria-expanded`, and `type` match. Only Radix's `id` and `data-state` are absent until
   the real trigger mounts.
2. Sonner's empty `aria-live` `<section>` is not server-rendered on marketing pages. It
   mounts on first interaction, before any toast can fire.

Hero motion (`hero-motion.module.css`), fonts, tokens, and copy are untouched. Reduced
motion is still honoured by the existing `prefers-reduced-motion` rules. The visual
snapshots are linux-only and were **not** regenerated or run on Windows. The verifier
should run `pnpm test:e2e e2e/visual` on Linux.

## SEO checks (final build)

- `/sitemap.xml`: 23 URLs, all 200. `/robots.txt` disallows `/portal`, `/admin`,
  `/api`, and `/auth`, and points at `https://dobeu.net/sitemap.xml`.
- Every sitemap URL has a unique `<title>`, a description, and a canonical on
  `https://dobeu.net` (`metadataBase` via `getSiteUrl()`). No duplicate titles or
  canonicals. `/login` is `noindex, nofollow`.
- Internal links found on those pages: 25 checked. All return 200 except `/portal`,
  which redirects with 307 to `/login` (expected auth gate).

## What is left (to reach mobile >= 90)

The remaining cost is mostly outside this builder's file set or the visual constraint:

- **Framework floor.** React DOM plus the Next runtime is about 350 kB raw (105 kB gzip) of
  the 127 kB first load. Its evaluation and hydration task is about 230 ms of simulated
  main-thread time.
- **Paint happens after hydration on a fast origin.** Chrome commits the first contentful
  frame only after the async chunks execute, so Lantern charges all hydration JS to LCP.
  The simulated LCP of about 3.1 s matches TTI.
- **Style and layout.** About 600 ms simulated. Contributors: the 60 kB global Tailwind
  CSS (the `tailwind.config.ts` content globs cover portal and admin), and `CookieBanner`
  setting `--cookie-banner-offset` on `<html>` in a layout effect, which forces a
  whole-document style recalculation.
- An experiment that lazy-loaded `next/script`, Vercel Analytics, Speed Insights, and
  Intercom in `components/analytics-provider.tsx` (read-only, not committed) left First
  Load JS unchanged at 127 kB. That is not the lever.

Further gains would need one of these: Tailwind content scoping per route group
(`tailwind.config.ts`), a `CookieBanner` change (scope the offset variable instead of
setting it on `<html>`), or visual trade-offs such as removing `text-balance`/blur or
changing the hero reveal. All are out of scope for this pass.

CI note: `.github/workflows/ci.yml` runs only `pnpm lighthouse:ci` (mobile). The desktop
config runs only when invoked explicitly with
`pnpm exec lhci autorun --config=lighthouserc.desktop.cjs`.
