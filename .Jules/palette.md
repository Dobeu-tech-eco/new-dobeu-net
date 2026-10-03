## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.

## 2026-05-30 - Decorative Icons and Screen Readers
**Learning:** Screen readers announce SVG icons unnecessarily if they are not explicitly hidden, even when the parent element has a valid accessible label (like `sr-only` text or an `aria-label`).
**Action:** When adding visual or decorative SVG icons to interactive elements, always ensure the icons are marked with `aria-hidden="true"` to prevent redundant announcements.
