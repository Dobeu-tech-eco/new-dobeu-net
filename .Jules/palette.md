## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.
## 2024-05-18 - Ensure Accessibility for Responsively Hidden Text
**Learning:** When using Tailwind classes like `hidden sm:inline` to hide text within links or buttons on smaller screens, it causes a loss of context for screen reader users and those without textual labels.
**Action:** Always add an explicit `aria-label` and `title` to the parent element, and `aria-hidden="true"` to any accompanying decorative child icons to ensure full accessibility and clear tooltips on hover across all device sizes.
