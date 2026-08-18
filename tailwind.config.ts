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
