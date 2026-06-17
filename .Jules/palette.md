## 2026-05-29 - Visual Feedback for Async Operations

**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.
## 2026-06-10 - Responsive Hidden Text Accessibility
**Learning:** When hiding text responsively inside buttons or links (e.g., `hidden sm:inline`), the parent interactive element loses its accessible name on smaller screens, breaking screen reader usability.
**Action:** Always add an explicit `aria-label` and `title` to the parent element, and `aria-hidden="true"` to the child icon to ensure consistent accessibility across all screen sizes.
