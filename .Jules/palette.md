## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.

## 2026-06-02 - Responsive Hidden Text Accessibility
**Learning:** When using Tailwind classes like `hidden sm:inline` to hide text on smaller screens (leaving only an icon visible), the element becomes an icon-only button/link for mobile users, making it completely inaccessible to screen readers and unclear to some users without context.
**Action:** Always add `aria-label` and `title` to the parent interactive element (button or link) containing conditionally hidden text. Additionally, set `aria-hidden="true"` on the child icon so screen readers read the explicit label rather than guessing the icon meaning or reading both.
