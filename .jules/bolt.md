## 2026-05-22 - Dynamic Imports for Heavy Third-Party Modals

**Learning:** When heavy third-party components (like Typeform or Calendly embeds) are placed inside hidden modals (like Dialogs/Tabs) they are still loaded in the initial JS bundle, increasing the First Load JS size unnecessarily.

**Action:** Wrap these heavy, conditionally-rendered third-party component imports in `next/dynamic` so they are lazy-loaded only when the user clicks to open the modal/tab. This drastically reduces the initial JS footprint.
