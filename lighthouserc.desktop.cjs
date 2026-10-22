/**
 * Lighthouse CI — desktop preset.
 *   pnpm build && pnpm exec lhci autorun --config=lighthouserc.desktop.cjs
 * Same URLs and thresholds as the mobile config (lighthouserc.cjs).
 *
 * @type {import('@lhci/cli').Config}
 */
module.exports = {
  ci: {
    collect: {
      url: ["http://localhost:3000/", "http://localhost:3000/labs"],
      numberOfRuns: 3,
      settings: {
        preset: "desktop",
      },
      startServerCommand: "pnpm start",
      startServerReadyPattern: "Ready",
      startServerReadyTimeout: 120_000,
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.95 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
