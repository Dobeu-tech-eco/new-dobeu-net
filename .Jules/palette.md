## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.
## 2024-10-24 - Async Button Loading States & Accessibility
**Learning:** In custom async components (like MFA enrollment), relying purely on text changes (e.g., "Starting...") provides poor visual feedback and no context to assistive technologies. Additionally, existing icons (like `Loader2`) often lack `aria-hidden="true"`, causing screen readers to announce them unnecessarily.
**Action:** Always add `aria-busy={loadingState}` to async buttons. When inserting spinners, use `inline-flex items-center justify-center` for proper alignment and always mark the spinner with `aria-hidden="true"`.
