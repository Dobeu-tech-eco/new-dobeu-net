## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.

## 2026-06-11 - Accessible Responsive Hidden Text
**Learning:** When using responsive utility classes to hide text inside buttons or links on small screens (e.g., `hidden sm:inline`), those elements visually become icon-only but lack accessible names for screen readers and tooltips for sighted users.
**Action:** Always add explicit `aria-label` and `title` to the parent button/link, and mark the child icon with `aria-hidden="true"` to ensure full accessibility and usability across all breakpoints.
