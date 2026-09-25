## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.
## 2024-05-28 - Async Button Loading States & Accessibility
**Learning:** While most forms disabled their submit buttons during async operations, many lacked a visual loading indicator (e.g., a spinner) and the `aria-busy` attribute. This causes screen readers to miss the loading state transition and users to not see immediate visual feedback beyond disabled text.
**Action:** Always include a visual spinner (like `Loader2` with `animate-spin`) next to loading text, mark it `aria-hidden="true"`, and add `aria-busy={pending}` to the `<Button>` during async submissions.
