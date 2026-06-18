## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.

## 2026-05-29 - Responsive Text Hiding Accessibility
**Learning:** When using Tailwind's `hidden` class (e.g., `hidden sm:inline`) to hide text inside buttons on smaller screens, the button loses its accessible name for screen readers on mobile devices if only an icon is visible.
**Action:** Always add explicit `aria-label` and `title` attributes to the parent button element, and `aria-hidden="true"` to the child icon element to ensure screen reader accessibility on all screen sizes when text is responsively hidden.
