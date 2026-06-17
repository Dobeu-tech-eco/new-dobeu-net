## 2026-05-29 - Visual Feedback for Async Operations

**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.

## 2026-05-30 - Responsive Text and Icon Accessibility
**Learning:** Tailwind responsive classes like `hidden sm:inline` hide text visually on small screens but don't automatically provide alternative accessible names. This turns elements effectively into icon-only buttons on mobile without screen readers knowing what they do.
**Action:** When hiding text responsively inside buttons or links, always add an explicit `aria-label` and `title` to the parent element, and `aria-hidden="true"` to the child icon to ensure screen reader accessibility on smaller screens.
