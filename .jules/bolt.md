## 2026-05-22 - [Lazy Loading Hidden Third-Party Embeds]
**Learning:** Heavy third-party integrations like Calendly (`react-calendly`) and Typeform (`@typeform/embed-react`) were being statically imported and eagerly loaded on the main landing page, even though they were hidden inside a Dialog (lightbox) and Tabs components that the user might never open. Statically importing these inflates the First Load JS size.
**Action:** When heavy third-party components are conditionally rendered or hidden behind UI interactions (like modals, lightboxes, or non-default tabs), always use `next/dynamic` to lazy load them. This defers downloading their JavaScript payload until the user actually interacts with that specific UI element, significantly reducing the initial bundle size.

## 2026-10-05 - [Pause continuous WebGL animations when off-screen]
**Learning:** Continuous WebGL animations or shaders (like `@paper-design/shaders-react`'s `GrainGradient`) run RequestAnimationFrame loops that continuously consume CPU/GPU resources even when the component is scrolled completely off-screen.
**Action:** Always use an intersection observer (e.g., `useInView` from `motion/react`) to dynamically set the `speed` parameter (or equivalent animation state) to `0` when the element is off-screen, pausing the rAF loop and saving resources.
