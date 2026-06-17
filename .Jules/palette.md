## 2026-05-29 - Visual Feedback for Async Operations

**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.

## 2026-06-06 - Accessible Responsive Hidden Text
**Learning:** Using responsive classes like `hidden sm:inline` on text labels inside buttons and links leaves those elements inaccessible to screen reader users on small screens because the icon lacks an accessible name and the text is `display: none`.
**Action:** When hiding text labels on smaller screens, ensure the parent element (button or link) has explicit `aria-label` and `title` attributes with the label's text, and apply `aria-hidden="true"` to the child icon to prevent redundant or confusing screen reader announcements.
