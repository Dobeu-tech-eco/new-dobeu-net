## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.
## 2024-03-24 - Improve Screen Reader Experience for Loading Buttons
**Learning:** For asynchronous form submissions with loading state indicators (like spinners), buttons often lack necessary `aria-busy` and `aria-hidden` attributes in this app.
**Action:** When creating or modifying loading buttons, ensure the parent `<Button>` receives an `aria-busy={pending}` attribute (so screen readers understand it's busy loading), and explicitly mark the nested icon/spinner element with `aria-hidden="true"`.
