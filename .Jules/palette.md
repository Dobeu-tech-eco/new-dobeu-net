## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.

## 2026-06-20 - Accessible Responsively Hidden Text
**Learning:** When using Tailwind's `hidden` class (e.g., `hidden sm:inline`) to hide text inside buttons or links on small screens, screen readers will no longer read the text, effectively turning them into icon-only buttons on mobile devices without accessible names.
**Action:** Always add an explicit `aria-label` and `title` to the parent element, and `aria-hidden="true"` to the child icon to ensure screen reader accessibility on smaller screens when text is hidden responsively.
