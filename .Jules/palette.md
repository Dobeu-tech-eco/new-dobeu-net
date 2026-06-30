## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.

## 2026-05-29 - Accessible Icon-Only Buttons on Mobile
**Learning:** When using Tailwind's responsive `hidden` classes (like `hidden sm:inline`) to hide text inside interactive elements on smaller screens, screen readers will not announce the element's purpose since they ignore elements with `display: none`. This effectively creates an unlabeled button for mobile screen reader users.
**Action:** Always add explicit `aria-label` and `title` attributes to the parent button/link element, and `aria-hidden="true"` to the child icon when text is conditionally hidden responsively.
