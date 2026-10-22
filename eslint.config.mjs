import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // Existing hydration and external-state effects predate the Next 16 compiler
  // rules. Report these as warnings while retaining the previous lint gate.
  {
    files: [
      "app/login/LoginForm.tsx",
      "components/landing/BookingTab.tsx",
      "components/landing/StickyMobileCTA.tsx",
      "components/portal/MfaStatus.tsx",
      "components/theme-toggle.tsx",
      "hooks/use-cookie-consent.ts",
    ],
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
