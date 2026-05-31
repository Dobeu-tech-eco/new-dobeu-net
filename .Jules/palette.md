## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.

## 2026-05-30 - Mobile Accessibility for Icon-with-Text Responsive Links
**Learning:** When using Tailwind's `hidden` class (e.g., `hidden sm:inline`) to hide text responsively inside buttons or links, the element becomes essentially "icon-only" on smaller screens. Screen readers may misinterpret or fail to announce these elements if the remaining icon lacks proper ARIA attributes, while visual users get no context on hover without a tooltip.
**Action:** Always add explicit `aria-label` and `title` to the parent element, and `aria-hidden="true"` to the child icon to ensure screen reader accessibility and provide a hover tooltip on all screen sizes.
