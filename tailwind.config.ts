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
  // Raw Dobeu palette (rarely used directly — prefer semantic tokens below)
  dobeu: {
    indigo: {
      50: "hsl(var(--dobeu-indigo-50))",
      100: "hsl(var(--dobeu-indigo-100))",
      200: "hsl(var(--dobeu-indigo-200))",
      300: "hsl(var(--dobeu-indigo-300))",
      400: "hsl(var(--dobeu-indigo-400))",
      500: "#6B5CE7",
      600: "#5A4DD4",
      700: "#4A3FA8",
      800: "#3A327F",
      900: "#2B2660",
      slate: "#5A4FAB" /* v2 wordmark + light-mode heading color */
    },
    amber: {
      500: "#F4A261",
      600: "#E08B47"
    },
    ink: {
      900: "#1A1A2E",
      800: "#222338",
      700: "#2F3047"
    },
    paper: {
      50: "#FAFAFC",
      100: "#F2F3F7",
      200: "#E5E7EE"
    },
    cream: {
      50: "#FFF8F0" /* v2 light-mode secondary surface */
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
  glow: "0 0 40px -10px hsl(var(--primary) / 0.5)",
  "amber-glow": "0 0 40px -10px hsl(var(--accent) / 0.5)"
};

const backgroundImage = {
  "dobeu-hero": "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--primary) / 0.15), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, hsl(var(--accent) / 0.12), transparent 60%)",
  "dobeu-mesh": "radial-gradient(at 0% 0%, hsl(var(--primary) / 0.18) 0%, transparent 50%), radial-gradient(at 100% 100%, hsl(var(--accent) / 0.14) 0%, transparent 50%), radial-gradient(at 50% 50%, hsl(var(--primary) / 0.06) 0%, transparent 60%)"
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
