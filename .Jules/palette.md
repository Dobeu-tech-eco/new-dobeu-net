## 2026-05-29 - Visual Feedback for Async Operations

**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.

## 2026-05-29 - Accessible Responsive Buttons
**Learning:** When using Tailwind's `hidden` class (e.g., `hidden sm:inline`) to hide text responsively inside buttons or links, the element essentially becomes an icon-only button on smaller screens. This causes screen readers to have no accessible name for the interactive element, and sighted users lack tooltips.
**Action:** Always add an explicit `aria-label` and `title` to the parent interactive element, and `aria-hidden="true"` to the child icon to ensure screen reader accessibility and correct tooltip behavior on smaller screens.
