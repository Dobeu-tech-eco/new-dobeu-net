## 2026-05-22 - [Lazy Loading Hidden Third-Party Embeds]
**Learning:** Heavy third-party integrations like Calendly (`react-calendly`) and Typeform (`@typeform/embed-react`) were being statically imported and eagerly loaded on the main landing page, even though they were hidden inside a Dialog (lightbox) and Tabs components that the user might never open. Statically importing these inflates the First Load JS size.
**Action:** When heavy third-party components are conditionally rendered or hidden behind UI interactions (like modals, lightboxes, or non-default tabs), always use `next/dynamic` to lazy load them. This defers downloading their JavaScript payload until the user actually interacts with that specific UI element, significantly reducing the initial bundle size.

## 2026-05-23 - [Pausing Off-Screen WebGL Animations]
**Learning:** Continuous WebGL animations (like `@paper-design/shaders-react`'s `GrainGradient`) run an active requestAnimationFrame loop that constantly consumes CPU and GPU resources even when they are scrolled out of the viewport.
**Action:** When using continuous WebGL animations or shaders, always attach an intersection observer (e.g., `useInView` from `motion/react`) to an always-rendered parent element. Use its state to dynamically set the animation `speed` to `0` when off-screen, automatically pausing the rAF loop.
