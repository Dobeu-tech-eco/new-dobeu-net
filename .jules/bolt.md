## 2026-05-22 - [Lazy Loading Hidden Third-Party Embeds]
**Learning:** Heavy third-party integrations like Calendly (`react-calendly`) and Typeform (`@typeform/embed-react`) were being statically imported and eagerly loaded on the main landing page, even though they were hidden inside a Dialog (lightbox) and Tabs components that the user might never open. Statically importing these inflates the First Load JS size.
**Action:** When heavy third-party components are conditionally rendered or hidden behind UI interactions (like modals, lightboxes, or non-default tabs), always use `next/dynamic` to lazy load them. This defers downloading their JavaScript payload until the user actually interacts with that specific UI element, significantly reducing the initial bundle size.

## 2024-05-22 - [Isolate High-Frequency State Updates]
**Learning:** The `useTypewriter` hook updates state every 52ms. Because it was called at the top level of the massive `Hero` component, it caused the entire hero section (including capability cards and backdrop) to unnecessarily re-render ~20 times a second.
**Action:** Always extract high-frequency interval-based state updates (like typewriters, tickers, or timers) into isolated leaf components. This restricts the re-render boundary to just the elements that actually change visually, preserving performance for the rest of the application.
