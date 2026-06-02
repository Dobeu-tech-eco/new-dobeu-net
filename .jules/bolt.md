## 2026-05-21 - [Heavy Component Lazy Loading]
**Learning:** Initial JS bundle sizes can be significantly improved by lazy loading heavy 3rd-party components (like Calendly or Typeform embed widgets) inside conditional or hidden components (like Radix UI Dialog or Tabs).
**Action:** When implementing any modal or hidden tab interface containing large dependencies, explicitly split those components out using `next/dynamic` and add a visual fallback.
