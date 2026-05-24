# Performance Baseline

Date: 2026-05-23

## Measurements

### Lighthouse (mobile, performance-only)
- Command: `pnpm dlx lighthouse http://localhost:3000 --only-categories=performance --form-factor=mobile --chrome-flags="--headless --no-sandbox" --output=json --output-path=docs/review/lighthouse-mobile.json --quiet`
- Result: **78 / 100**
- Report artifact: `docs/review/lighthouse-mobile.json`

### E2E smoke
- Command: `pnpm test:e2e`
- Result: **17/17 passed**

### Unit + build verification
- Command: `pnpm verify`
- Result: **pass** (`type-check`, `lint`, `test:ci`, `build`)

## Notable optimization applied during this pass
- Lazy-loaded heavy lightbox tabs to reduce initial JS:
  - `components/landing/LightboxProvider.tsx` now dynamically imports `BookingTab` and `TypeformTab`.

## Remaining gap
- Target is mobile performance >= 90.
- Current score is 78, so this remains a release blocker for the strict performance gate.
