## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.

## 2026-05-30 - Responsive Text Accessibility in Navigation
**Learning:** Using `display: none` (like Tailwind's `hidden`) for responsive text in icon buttons removes the accessible name from the accessibility tree on mobile devices, rendering the button indistinguishable to screen readers.
**Action:** Always provide an explicit `aria-label` or `title` on navigation links or buttons where the descriptive text is visually hidden on smaller screens, and use `aria-hidden="true"` on the accompanying icons.
