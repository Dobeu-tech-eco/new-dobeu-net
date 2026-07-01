## 2026-05-22 - [Lazy Loading Hidden Third-Party Embeds]
**Learning:** Heavy third-party integrations like Calendly (`react-calendly`) and Typeform (`@typeform/embed-react`) were being statically imported and eagerly loaded on the main landing page, even though they were hidden inside a Dialog (lightbox) and Tabs components that the user might never open. Statically importing these inflates the First Load JS size.
**Action:** When heavy third-party components are conditionally rendered or hidden behind UI interactions (like modals, lightboxes, or non-default tabs), always use `next/dynamic` to lazy load them. This defers downloading their JavaScript payload until the user actually interacts with that specific UI element, significantly reducing the initial bundle size.

## 2024-07-01 - [Pause High-Frequency Animations Off-Screen]
**Learning:** The `useTypewriter` hook was running a state update every 52ms, causing the entire `Hero` component to re-render continuously even when the user scrolled past it. This wastes CPU cycles and battery life.
**Action:** Always use `useInView` to pause high-frequency polling, timeouts, or interval-based UI state updates (like typewriters or carousels) when the component is no longer visible in the viewport.
