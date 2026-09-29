## 2026-05-22 - [Lazy Loading Hidden Third-Party Embeds]
**Learning:** Heavy third-party integrations like Calendly (`react-calendly`) and Typeform (`@typeform/embed-react`) were being statically imported and eagerly loaded on the main landing page, even though they were hidden inside a Dialog (lightbox) and Tabs components that the user might never open. Statically importing these inflates the First Load JS size.
**Action:** When heavy third-party components are conditionally rendered or hidden behind UI interactions (like modals, lightboxes, or non-default tabs), always use `next/dynamic` to lazy load them. This defers downloading their JavaScript payload until the user actually interacts with that specific UI element, significantly reducing the initial bundle size.

## 2026-08-11 - [Pause WebGL Shaders Off-Screen]
**Learning:** Continuous `requestAnimationFrame` loops in WebGL shaders (like `@paper-design/shaders-react`) consume significant CPU and GPU resources even when the element is off-screen.
**Action:** When using continuous animations or shaders that support a speed parameter, always use an intersection observer (like `useInView` from `motion/react`) to set the speed to `0` when the element is not visible in the viewport, pausing the rAF loop and saving resources.
