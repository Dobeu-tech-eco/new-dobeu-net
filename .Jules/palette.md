## 2024-06-28 - Missing accessible names on responsive icon-only buttons
**Learning:** When using Tailwind's `hidden` class (e.g., `hidden sm:inline`) to hide text inside buttons on smaller screens, the text is removed from the accessibility tree. This leaves the button with no accessible name on mobile devices, breaking screen reader functionality.
**Action:** Always add an explicit `aria-label` and `title` to the parent button/link element, and `aria-hidden="true"` to the child icon, to ensure consistent accessibility and tooltips across all device sizes.
