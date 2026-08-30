# Theme tokens — Dobeu Design System v3

Framework tokens live in `app/globals.css` (`:root` / `.dark`) and `tailwind.config.ts` (`theme.extend`). `darkMode: ["class"]`. Nunito is loaded in `app/layout.tsx` as `--font-nunito`. Theme wrapper: `components/theme-provider.tsx` (`defaultTheme="light"`, `enableSystem`).

## Part 1 — Compact token summary

### Brand primitives (hex / HSL)

| Token | Hex | HSL (no wrapper) |
| --- | --- | --- |
| Deep Violet (primary brand) | `#5B4FD9` | `245 63% 58%` (`--dobeu-violet-500`) |
| Coral Amber (CTA / dark primary) | `#F59555` | `24 89% 64%` (`--dobeu-amber-500`) |
| Void (dark canvas) | `#111120` | `243 30% 10%` (`--dobeu-ink-900`) |
| Slate (wordmark / light headings) | `#4A42A0` | `244 42% 44%` (`--brand-indigo-slate` / `--dobeu-violet-700`) |
| Clean White / paper | `#FAFAFA` | `0 0% 98%` (`--dobeu-paper-50`) |

Violet scale 50–900: `245 70% 97%` → `243 36% 24%`. Amber 600: `20 74% 55%` / `#D97D3F`. Legacy `--dobeu-indigo-*` aliases point at violet.

Mark fills (hardcoded in `DobeuMark`, not CSS vars): left `#6B5CE7`, right `#4A3FA8`, lens `#F4A261`.

### Semantic colors — `:root` (light)

| Token | Value |
| --- | --- |
| background | `0 0% 100%` |
| foreground | ink-900 `#111120` |
| card / popover | white + ink-900 fg |
| primary | violet-500; fg paper-50 |
| secondary | `240 6% 97%`; fg ink-900 |
| accent | amber-500; fg ink-900 |
| muted | `240 8% 96%`; fg `243 6% 40%` |
| destructive | `0 75% 55%`; fg white |
| border / input | `245 55% 91%` (`--brand-border-light`) |
| ring | violet-500 |
| elevated | white |
| fg-heading | slate `#4A42A0` |
| tints | indigo-10 `245 62% 95%`; amber-10 `24 90% 94%` |

### Semantic colors — `.dark`

| Token | Value |
| --- | --- |
| background | void `#111120` |
| foreground / card-fg / popover-fg | paper-50 |
| card | `243 28% 15%` |
| popover | `243 28% 13%` |
| primary | **coral amber** (CTA swap); fg ink-900 |
| secondary | `243 24% 18%`; fg paper-50 |
| accent | violet-400; fg ink-900 |
| muted | `243 22% 17%`; fg `243 8% 68%` |
| destructive | `0 65% 50%`; fg white |
| border / input | `243 22% 19%` (`--brand-border-dark`) |
| ring | amber-500 |
| elevated | `243 26% 16%` |
| fg-heading | paper-50 |

### Fonts

- Family: Nunito (`--font-nunito`) for both `font-sans` and `font-display`; weights 400/500/600/700/800.
- Mono: `ui-monospace, SFMono-Regular, Menlo, monospace`.
- Type scale: Tailwind defaults (text-xs … text-4xl). Display headings use `font-display font-extrabold tracking-tight`. Badge: 11px / 700 / uppercase / `0.03em`.

### Spacing

- No custom spacing scale — Tailwind default (4px base).
- Container: `center`, padding `1rem`, max `2xl: 1280px`.
- Card padding tokens: default `p-7` (28px), compact `p-5` (20px).

### Radius

| Token | Value | Tailwind |
| --- | --- | --- |
| `--radius-sm` | 6px | `rounded-sm` |
| `--radius-md` | 12px | `rounded` / `rounded-md` (Button) |
| `--radius-lg` | 20px | `rounded-lg` (Card) |
| `--radius-xl` | 24px | `rounded-xl` |
| `--radius-pill` | 999px | `rounded-pill` (Badge) |

### Shadows / glows

| Token | Value |
| --- | --- |
| `shadow-glow` | `0 0 40px -10px hsl(var(--dobeu-violet-500) / 0.45)` |
| `shadow-amber-glow` | `0 0 40px -10px hsl(var(--dobeu-amber-500) / 0.45)` |
| plus Tailwind `shadow-sm` / `shadow-lg` / `shadow-2xl` |

Brand rule: Card uses **border OR `shadow-sm`, not both**.

### Breakpoints

Default Tailwind: `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`. Container caps at 1280.

### Motion / utilities

Keyframes: `accordion-down/up` 0.2s, `fade-up` 0.5s, `shimmer` 2.5s. Utilities: `.gradient-text`, `.gradient-text-deep`, `.glass`, `.skip-link`, `.scrollbar-none`. `prefers-reduced-motion` collapses animation and forces opacity 1.

---

## Part 2 — Raw source dumps

### `tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * Dobeu Design System v2 — Tailwind config.
 * Source of truth: @dobeu/tokens. CSS variables are emitted in app/globals.css.
 * Never hardcode hex values in components — always reference CSS variables here.
 */

const fontFamily = {
  sans: ["var(--font-nunito)", "ui-sans-serif", "system-ui", "sans-serif"],
  display: ["var(--font-nunito)", "ui-sans-serif", "system-ui", "sans-serif"],
  mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
};

const colors = {
  // Raw Dobeu palette v3 (rarely used directly — prefer semantic tokens below)
  dobeu: {
    violet: {
      50:  "hsl(var(--dobeu-violet-50))",
      100: "hsl(var(--dobeu-violet-100))",
      200: "hsl(var(--dobeu-violet-200))",
      300: "hsl(var(--dobeu-violet-300))",
      400: "hsl(var(--dobeu-violet-400))",
      500: "#5B4FD9",  /* Deep Violet — primary brand */
      600: "#4C43C0",
      700: "#4A42A0",  /* Slate — wordmark / headings */
      800: "#38307A",
      900: "#271F57",
      slate: "#4A42A0"
    },
    // Legacy indigo aliases → resolve to violet tokens at runtime via CSS vars
    indigo: {
      50:  "hsl(var(--dobeu-indigo-50))",
      100: "hsl(var(--dobeu-indigo-100))",
      200: "hsl(var(--dobeu-indigo-200))",
      300: "hsl(var(--dobeu-indigo-300))",
      400: "hsl(var(--dobeu-indigo-400))",
      500: "hsl(var(--dobeu-indigo-500))",
      600: "hsl(var(--dobeu-indigo-600))",
      700: "hsl(var(--dobeu-indigo-700))",
      800: "hsl(var(--dobeu-indigo-800))",
      900: "hsl(var(--dobeu-indigo-900))",
      slate: "hsl(var(--brand-indigo-slate))"
    },
    amber: {
      500: "#F59555",  /* Coral Amber v3 — CTA accent on dark */
      600: "#D97D3F"
    },
    ink: {
      900: "#111120",  /* Void dark canvas v3 */
      800: "#1A1A2E",  /* Legacy dark (still used in some radial glows) */
      700: "#242440"
    },
    paper: {
      50:  "#FAFAFA",
      100: "#F4F4F6",
      200: "#E8E8EE"
    },
    cream: {
      50: "#FFF8F0"
    }
  },
  "fg-heading": "hsl(var(--fg-heading))",
  // Semantic tokens — always prefer these in components
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  card: {
    DEFAULT: "hsl(var(--card))",
    foreground: "hsl(var(--card-foreground))"
  },
  popover: {
    DEFAULT: "hsl(var(--popover))",
    foreground: "hsl(var(--popover-foreground))"
  },
  primary: {
    DEFAULT: "hsl(var(--primary))",
    foreground: "hsl(var(--primary-foreground))"
  },
  secondary: {
    DEFAULT: "hsl(var(--secondary))",
    foreground: "hsl(var(--secondary-foreground))"
  },
  accent: {
    DEFAULT: "hsl(var(--accent))",
    foreground: "hsl(var(--accent-foreground))"
  },
  muted: {
    DEFAULT: "hsl(var(--muted))",
    foreground: "hsl(var(--muted-foreground))"
  },
  destructive: {
    DEFAULT: "hsl(var(--destructive))",
    foreground: "hsl(var(--destructive-foreground))"
  },
  border: "hsl(var(--border))",
  input: "hsl(var(--input))",
  ring: "hsl(var(--ring))",
  elevated: "hsl(var(--elevated))"
};

const borderRadius = {
  sm: "var(--radius-sm)",
  DEFAULT: "var(--radius-md)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  pill: "var(--radius-pill)"
};

const boxShadow = {
  // v3: glow always references the violet (not the amber CTA swap) for consistent hover glow
  glow: "0 0 40px -10px hsl(var(--dobeu-violet-500) / 0.45)",
  "amber-glow": "0 0 40px -10px hsl(var(--dobeu-amber-500) / 0.45)"
};

const backgroundImage = {
  // v3: violet + coral-amber radial glows — subtle mesh for hero & card overlays
  "dobeu-hero": "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--dobeu-violet-500) / 0.12), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, hsl(var(--dobeu-amber-500) / 0.09), transparent 60%)",
  "dobeu-mesh": "radial-gradient(at 0% 0%, hsl(var(--dobeu-violet-500) / 0.15) 0%, transparent 50%), radial-gradient(at 100% 100%, hsl(var(--dobeu-amber-500) / 0.12) 0%, transparent 50%), radial-gradient(at 50% 50%, hsl(var(--dobeu-violet-500) / 0.05) 0%, transparent 60%)"
};

const keyframes = {
  "accordion-down": {
    from: { height: "0" },
    to: { height: "var(--radix-accordion-content-height)" }
  },
  "accordion-up": {
    from: { height: "var(--radix-accordion-content-height)" },
    to: { height: "0" }
  },
  "fade-up": {
    "0%": { opacity: "0", transform: "translateY(8px)" },
    "100%": { opacity: "1", transform: "translateY(0)" }
  },
  shimmer: {
    "0%": { backgroundPosition: "-200% 0" },
    "100%": { backgroundPosition: "200% 0" }
  }
};

const animation = {
  "accordion-down": "accordion-down 0.2s ease-out",
  "accordion-up": "accordion-up 0.2s ease-out",
  "fade-up": "fade-up 0.5s ease-out",
  shimmer: "shimmer 2.5s linear infinite"
};

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1280px"
      }
    },
    extend: {
      fontFamily,
      colors,
      borderRadius,
      boxShadow,
      backgroundImage,
      keyframes,
      animation
    }
  },
  plugins: [animate]
};

export default config;
```

### `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ============================================================================
 * Dobeu Design System v3 — CSS variables
 * Palette refresh: Deep Violet primary, Coral Amber CTA, Void dark canvas.
 * Values are HSL components (no hsl() wrapper) so Tailwind's `hsl(var(--x))` works.
 * Brand colors NEVER hardcoded in components — always via token → Tailwind.
 * ============================================================================
 *
 * Core 5 brand colors:
 *   Deep Violet  #5B4FD9  hsl(245, 63%, 58%)   ← primary (replaces indigo #6B5CE7)
 *   Coral Amber  #F59555  hsl(24, 89%, 64%)    ← CTA accent dark (replaces #F4A261)
 *   Void         #111120  hsl(243, 30%, 10%)   ← dark canvas (replaces #1A1A2E)
 *   Slate        #4A42A0  hsl(244, 42%, 44%)   ← wordmark / light headings
 *   Clean White  #FAFAFA  hsl(0, 0%, 98%)      ← light canvas
 * ============================================================================ */

@layer base {
  :root {
    /* ---- Raw Dobeu palette (HSL) — v3 ---- */
    --dobeu-violet-50:  245 70% 97%;
    --dobeu-violet-100: 245 68% 93%;
    --dobeu-violet-200: 245 66% 86%;
    --dobeu-violet-300: 245 64% 76%;
    --dobeu-violet-400: 245 63% 68%;
    --dobeu-violet-500: 245 63% 58%;   /* #5B4FD9 — primary brand */
    --dobeu-violet-600: 244 54% 50%;
    --dobeu-violet-700: 244 42% 44%;   /* #4A42A0 — slate */
    --dobeu-violet-800: 244 38% 34%;
    --dobeu-violet-900: 243 36% 24%;

    /* Keep legacy indigo aliases pointing to new violet for smooth migration */
    --dobeu-indigo-50:  var(--dobeu-violet-50);
    --dobeu-indigo-100: var(--dobeu-violet-100);
    --dobeu-indigo-200: var(--dobeu-violet-200);
    --dobeu-indigo-300: var(--dobeu-violet-300);
    --dobeu-indigo-400: var(--dobeu-violet-400);
    --dobeu-indigo-500: var(--dobeu-violet-500);
    --dobeu-indigo-600: var(--dobeu-violet-600);
    --dobeu-indigo-700: var(--dobeu-violet-700);
    --dobeu-indigo-800: var(--dobeu-violet-800);
    --dobeu-indigo-900: var(--dobeu-violet-900);

    --dobeu-amber-500: 24 89% 64%;    /* #F59555 — coral amber (v3) */
    --dobeu-amber-600: 20 74% 55%;

    --dobeu-ink-900:  243 30% 10%;    /* #111120 — void dark canvas (v3) */
    --dobeu-paper-50: 0 0% 98%;       /* #FAFAFA — clean white (v3) */

    /* ---- v3 brand primitives ---- */
    /* Slate #4A42A0 — wordmark color + light-mode heading color */
    --brand-indigo-slate: 244 42% 44%;
    /* Light canvas */
    --brand-cream-soft: 0 0% 100%;
    /* Borders */
    --brand-border-light: 245 55% 91%; /* light violet-tinted rule */
    --brand-border-dark:  243 22% 19%; /* dark void-tinted rule */
    /* 10% tints (badges, pills, soft fills) */
    --brand-tint-indigo-10: 245 62% 95%;
    --brand-tint-amber-10:  24 90% 94%;
    /* Heading foreground (slate in light, paper in dark) */
    --fg-heading: var(--brand-indigo-slate);

    /* ---- Light theme ---- */
    --background: 0 0% 100%;
    --foreground: var(--dobeu-ink-900);

    --card: 0 0% 100%;
    --card-foreground: var(--dobeu-ink-900);

    --popover: 0 0% 100%;
    --popover-foreground: var(--dobeu-ink-900);

    --primary: var(--dobeu-violet-500);
    --primary-foreground: var(--dobeu-paper-50);

    --secondary: 240 6% 97%;
    --secondary-foreground: var(--dobeu-ink-900);

    --accent: var(--dobeu-amber-500);
    --accent-foreground: var(--dobeu-ink-900);

    --muted: 240 8% 96%;
    --muted-foreground: 243 6% 40%;

    --destructive: 0 75% 55%;
    --destructive-foreground: 0 0% 100%;

    --border: var(--brand-border-light);
    --input: var(--brand-border-light);
    --ring: var(--dobeu-violet-500);

    --radius-sm: 6px;
    --radius-md: 12px;
    --radius-lg: 20px;
    --radius-xl: 24px;
    --radius-pill: 999px;

    --elevated: 0 0% 100%;
  }

  .dark {
    --background: var(--dobeu-ink-900);    /* #111120 void */
    --foreground: var(--dobeu-paper-50);

    /* Heading: fall back to paper-50 on dark */
    --fg-heading: var(--dobeu-paper-50);

    --card: 243 28% 15%;               /* slightly lifted above void */
    --card-foreground: var(--dobeu-paper-50);

    --popover: 243 28% 13%;
    --popover-foreground: var(--dobeu-paper-50);

    /* v3 CTA-swap: dark-mode primary = coral amber for maximum contrast pop */
    --primary: var(--dobeu-amber-500);
    --primary-foreground: var(--dobeu-ink-900);

    --secondary: 243 24% 18%;
    --secondary-foreground: var(--dobeu-paper-50);

    --accent: var(--dobeu-violet-400);
    --accent-foreground: var(--dobeu-ink-900);

    --muted: 243 22% 17%;
    --muted-foreground: 243 8% 68%;

    --destructive: 0 65% 50%;
    --destructive-foreground: 0 0% 100%;

    --border: var(--brand-border-dark);
    --input: var(--brand-border-dark);
    --ring: var(--dobeu-amber-500);

    /* Elevated surface — void + 5% lift */
    --elevated: 243 26% 16%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  html {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    scroll-behavior: smooth;
  }
  body {
    @apply bg-background text-foreground font-sans;
    font-feature-settings:
      "rlig" 1,
      "calt" 1,
      "ss01" 1;
  }
  /* Focus ring — accent-colored, high contrast */
  :focus-visible {
    @apply outline-none ring-2 ring-ring ring-offset-2 ring-offset-background;
  }
  /* Selection */
  ::selection {
    background-color: hsl(var(--primary) / 0.25);
    color: hsl(var(--foreground));
  }
  /* Reduce motion respectfully — WCAG 2.1 SC 2.3.3
   *
   * Two-layer fix:
   * 1. Kill animation / transition timing for CSS-driven motion.
   * 2. Force opacity to 1 on any element that uses Framer Motion's inline
   *    `style="opacity:0"` initial state — without this the element stays
   *    invisible because JS `animation-duration` collapse happens after the
   *    initial render flush. The `useMotionProps` hook is the primary fix;
   *    this CSS rule is a belt-and-suspenders fallback for any missed sites.
   */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
    /* Reveal any element whose opacity was set to 0 by a JS animation engine */
    [style*="opacity: 0"],
    [style*="opacity:0"] {
      opacity: 1 !important;
    }
  }
}

/* ---- Utility extensions ---- */
@layer utilities {
  .gradient-text {
    background: linear-gradient(
      to right,
      hsl(var(--dobeu-violet-500)) 0%,
      hsl(var(--dobeu-amber-500)) 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
  }
  .gradient-text-deep {
    background: linear-gradient(
      135deg,
      hsl(var(--primary)) 0%,
      hsl(var(--accent)) 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .glass {
    @apply bg-background/70 backdrop-blur-xl backdrop-saturate-150 border border-border/60;
  }
  .skip-link {
    @apply sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg;
  }
  /* Hide scrollbars on overflow containers (SubBrandsStrip ticker row) */
  .scrollbar-none {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }
}
```

### `components/theme-provider.tsx`

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

/**
 * next-themes wrapper. Supports Light / Dark / System with persistence.
 * Default theme = "light" per Design System v2 spec for dobeu.net (light-mode default
 * brand surface). Toggle + dark mode remain fully functional via `enableSystem`.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
```
