## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.

## 2026-05-30 - Accessible Interactive States in Buttons
**Learning:** While visual icons (like loading indicators or theme toggles) were present inside buttons, they were missing screen reader context. Screen readers would announce the SVG content instead of ignoring it, and buttons in an active submitting state didn't notify users they were busy processing.
**Action:** Always add `aria-hidden="true"` to decorative or state-driven icons inside buttons, and apply `aria-busy={pending}` to the parent `<Button>` when in a submitting/loading state.
