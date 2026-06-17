## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.

## 2026-06-01 - Screen Reader Accessibility for Responsive Text Hiding
**Learning:** When using Tailwind's `hidden sm:inline` (or similar responsive display classes) to hide text on small screens, screen readers may not read the text if the parent element is focused or interacted with on mobile, leaving users with just an icon they can't understand.
**Action:** Always add explicit `aria-label` and `title` attributes to the parent button/link, and add `aria-hidden="true"` to the child icon element when hiding its accompanying text responsively.
