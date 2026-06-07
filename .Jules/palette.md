## 2026-05-29 - Visual Feedback for Async Operations
**Learning:** Users often lack clear feedback when submitting forms, which can lead to double submissions or confusion. Using icon-only loading states combined with accessible text is crucial for asynchronous form operations.
**Action:** Always include a visual loading indicator (e.g., `Loader2` with `animate-spin`) in submit buttons alongside the loading text when the form is in a `submitting` state. Ensure disabled state is active to prevent duplicate requests.

## 2026-06-07 - Accessibility for Responsively Hidden Text
**Learning:** Using `hidden sm:inline` (or similar utility classes) on text within interactive elements (like links or buttons) causes accessibility issues on smaller screens. When the text is hidden, the element essentially becomes an icon-only button without an accessible name, making it difficult or impossible for screen reader users on mobile devices to understand the element's purpose.
**Action:** When hiding text responsively inside interactive elements with icons, always add an explicit `aria-label` and `title` to the parent element, and `aria-hidden="true"` to the child icon. This ensures that the accessible name is preserved across all viewport sizes while preventing screen readers from reading redundant icon descriptions.
