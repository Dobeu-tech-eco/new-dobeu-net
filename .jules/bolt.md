## 2026-05-22 - [Lazy Loading Hidden Third-Party Embeds]

**Learning:** Heavy third-party integrations like Calendly (`react-calendly`) and Typeform (`@typeform/embed-react`) were being statically imported and eagerly loaded on the main landing page, even though they were hidden inside a Dialog (lightbox) and Tabs components that the user might never open. Statically importing these inflates the First Load JS size.
**Action:** When heavy third-party components are conditionally rendered or hidden behind UI interactions (like modals, lightboxes, or non-default tabs), always use `next/dynamic` to lazy load them. This defers downloading their JavaScript payload until the user actually interacts with that specific UI element, significantly reducing the initial bundle size.

## 2025-02-12 - [Context Value Memoization to Prevent App-Wide Re-renders]

**Learning:** In React, passing an unmemoized object directly into a `Context.Provider`'s `value` prop (e.g., `value={{ open, close }}`) causes the provider to create a new object reference on every render. If the provider sits high up in the component tree (like `LightboxProvider` wrapping the entire landing page layout), any state change within the provider (like toggling a modal) triggers an app-wide re-render of all context consumers, even those whose props haven't actually changed.
**Action:** Always wrap context values in `React.useMemo` (e.g., `const contextValue = React.useMemo(() => ({ open, close }), [open, close]);`) before passing them to the `Provider`. This ensures referential equality is maintained across renders, preventing unnecessary re-renders of downstream consumers.
