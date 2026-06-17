## 2024-05-28 - Next.js Modal Third-Party Payload Optimization
**Learning:** Heavy third-party React libraries (like `react-calendly` and `@typeform/embed-react`) imported synchronously into Modal/Dialog components are included in the initial page bundle even if the modal isn't opened immediately, significantly bloating the First Load JS for landing pages.
**Action:** Always use `next/dynamic` to code-split and lazily load these heavy components only when the modal is opened, which in this codebase reduced the root page First Load JS by over 50% (from ~420kB to ~199kB).
