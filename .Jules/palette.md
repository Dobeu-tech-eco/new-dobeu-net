## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.

## 2026-07-01 - Adding Loading Spinners to Form Submissions
**Learning:** Adding a `Loader2` spinner to the async submit button in AdminQuoteForm prevents user confusion during processing. Always use `aria-hidden="true"` on the spinner to ensure screen readers only announce the text change.
**Action:** When implementing visual loading states in buttons, include an accessible `aria-hidden="true"` spinner to complement the text update.
