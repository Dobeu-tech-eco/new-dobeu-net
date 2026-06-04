import * as React from "react";

/**
 * Official Dobeu mark — three masked circles per Design System v2 (canonical
 * `uploads/dobeu-symbol.svg` from the brand kit). Flat fills, no gradient.
 *
 *   - Left lobe   #6B5CE7 (Indigo Vivid)
 *   - Right lobe  #4A3FA8 (Indigo Deep)
 *   - Lens        #F4A261 (Amber Sunset)
 *
 * Inlined SVG (no <img>/network round-trip), zero JS, crisp at any size.
 * Keeps the `{ className }` API so all 6 call sites continue to work unchanged.
 */
export function DobeuMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 500"
      role="img"
      aria-label="Dobeu mark"
      className={className}
    >
      <defs>
        <mask id="dobeu-mark-cutA" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
          <rect width="500" height="500" fill="#fff" />
          <circle cx="315" cy="235" r="78" fill="#000" />
        </mask>
        <mask id="dobeu-mark-cutC1" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
          <rect width="500" height="500" fill="#fff" />
          <circle cx="175" cy="248" r="122" fill="#000" />
        </mask>
        <mask
          id="dobeu-mark-cutC1A"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="500"
          height="500"
        >
          <rect width="500" height="500" fill="#fff" />
          <circle cx="175" cy="248" r="122" fill="#000" />
          <circle cx="315" cy="235" r="78" fill="#000" />
        </mask>
      </defs>
      <circle cx="322" cy="258" r="105" fill="#4A3FA8" mask="url(#dobeu-mark-cutC1A)" />
      <circle cx="175" cy="248" r="122" fill="#6B5CE7" mask="url(#dobeu-mark-cutA)" />
      <circle cx="315" cy="235" r="78" fill="#F4A261" mask="url(#dobeu-mark-cutC1)" />
    </svg>
  );
}
