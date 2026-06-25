## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.
## 2024-05-23 - Responsive Button Accessibility
**Learning:** When text inside a button or link is hidden responsively using Tailwind classes like `hidden sm:inline`, the element loses its accessible name on smaller screens, leaving screen reader users with an unlabelled button.
**Action:** Always provide an explicit `aria-label` and `title` to the parent element and hide the accompanying icon with `aria-hidden="true"` to ensure the element is accessible and discoverable across all viewport sizes.
