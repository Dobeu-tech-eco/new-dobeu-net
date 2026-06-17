## 2024-05-23 - [Code Split Lightbox Provider Tabs]
**Learning:** Next.js static page output bundles all heavy components unless lazily loaded with dynamic imports. In this application's `/` route, the first load JS size drops significantly from 420 kB down to 199 kB when components inside the `LightboxProvider` are lazily loaded.
**Action:** Use `next/dynamic` for heavy hidden UI elements like modals and tabs that are not needed on initial paint to save JS bundle size.
