## 2026-05-27 - Global SVG styles in Buttons
**Learning:** `components/ui/button.tsx` already styles child SVGs globally (`[&_svg]:size-4`), meaning we don't need to add manual sizing or margin classes to icons placed inside buttons.
**Action:** Use icons in buttons without applying redundant size or margin utility classes.
