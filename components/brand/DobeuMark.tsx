import * as React from "react";

/**
 * Dobeu mark — two overlapping circles with an amber crescent at the intersection.
 * Per Design System v2 spec. Theme-aware: uses CSS variables so it shifts in dark mode.
 */
export function DobeuMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Dobeu mark"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="dobeu-mark-indigo"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="hsl(var(--dobeu-indigo-500))" />
          <stop offset="100%" stopColor="hsl(var(--dobeu-indigo-700))" />
        </linearGradient>
        <mask id="dobeu-mark-crescent">
          <rect width="64" height="64" fill="black" />
          <circle cx="24" cy="32" r="18" fill="white" />
          <circle cx="40" cy="32" r="18" fill="black" />
        </mask>
      </defs>
      {/* Left circle (deep indigo) */}
      <circle
        cx="24"
        cy="32"
        r="18"
        fill="url(#dobeu-mark-indigo)"
        opacity="0.95"
      />
      {/* Right circle (primary indigo) */}
      <circle
        cx="40"
        cy="32"
        r="18"
        fill="hsl(var(--dobeu-indigo-500))"
        opacity="0.85"
      />
      {/* Amber crescent — visible where left circle is but right circle isn't */}
      <rect
        width="64"
        height="64"
        fill="hsl(var(--dobeu-amber-500))"
        mask="url(#dobeu-mark-crescent)"
      />
    </svg>
  );
}
