## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.
## 2024-10-04 - Screen Reader Feedback for Async Form Buttons
**Learning:** Across the app's forms, loading spinners (`Loader2`) were being read aloud by screen readers during async operations, and submit buttons lacked `aria-busy` states, leading to confusing accessibility feedback.
**Action:** Always add `aria-hidden="true"` to `Loader2` icons and `aria-busy={pending}` to parent buttons for async form submissions.
