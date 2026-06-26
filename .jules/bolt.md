## 2026-05-22 - [Lazy Loading Hidden Third-Party Embeds]
**Learning:** Heavy third-party integrations like Calendly (`react-calendly`) and Typeform (`@typeform/embed-react`) were being statically imported and eagerly loaded on the main landing page, even though they were hidden inside a Dialog (lightbox) and Tabs components that the user might never open. Statically importing these inflates the First Load JS size.
**Action:** When heavy third-party components are conditionally rendered or hidden behind UI interactions (like modals, lightboxes, or non-default tabs), always use `next/dynamic` to lazy load them. This defers downloading their JavaScript payload until the user actually interacts with that specific UI element, significantly reducing the initial bundle size.
## 2026-06-26 - Test Mocks Initialization
**Learning:** When mocking modules in Vitest, use `vi.hoisted(() => { ... })` to initialize mock objects and functions before they are referenced inside `vi.mock()`.
**Action:** Always wrap module-level mock objects in `vi.hoisted` to ensure they are available before Vitest automatically hoists the `vi.mock` declarations.

## 2026-06-26 - Async Module Initialization Testing
**Learning:** When writing or fixing tests for asynchronous initialization modules (e.g., initDatadog), always await the initialization function before making assertions on mock calls.
**Action:** Use `await` when calling asynchronous init functions in tests to ensure all internal promises have resolved before verifying the mock state.
