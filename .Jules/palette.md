## 2026-05-29 - Visual Feedback for Async Operations

**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.

## 2026-06-08 - Responsive Text Accessibility
**Learning:** When hiding text responsively inside an interactive element (e.g., `hidden sm:inline`), the element effectively becomes an icon-only button on smaller screens, making it inaccessible to screen readers if it lacks an explicit `aria-label`.
**Action:** Always provide an explicit `aria-label` and `title` on the parent element, and `aria-hidden="true"` on the child icon, to ensure it remains accessible regardless of screen size.
