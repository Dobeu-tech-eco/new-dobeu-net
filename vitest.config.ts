import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "e2e/**", ".worktrees/**"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["app/**", "lib/**", "hooks/**", "components/**", "containers/**"],
      exclude: [
        "**/*.{test,spec}.{ts,tsx}",
        "**/*.d.ts",
        "lib/database.types.ts",
        "**/node_modules/**",
        "**/.next/**",
      ],
      // No `thresholds` yet — deliberately. Coverage has never been measured
      // in this repo, so a number picked blind would either fail every PR or
      // be meaninglessly low. Run `pnpm test:ci -- --coverage` once, read the
      // text-summary, then set thresholds at or just under the real figure
      // and raise them over time. CLAUDE.md's stated 80% target is where
      // this should land, not where it should start.
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
