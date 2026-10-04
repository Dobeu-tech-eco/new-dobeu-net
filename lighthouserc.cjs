/** @type {import('@lhci/cli').Config} */
const lighthousePort = process.env.LIGHTHOUSE_PORT || "3000";

module.exports = {
  ci: {
    collect: {
      url: [`http://localhost:${lighthousePort}/`, `http://localhost:${lighthousePort}/labs`],
      numberOfRuns: 3,
      settings: {
        formFactor: "mobile",
        throttlingMethod: "simulate",
        screenEmulation: {
          mobile: true,
          width: 412,
          height: 823,
          deviceScaleFactor: 2.625,
          disabled: false,
        },
      },
      startServerCommand: `pnpm exec next start --port ${lighthousePort}`,
      startServerReadyPattern: "Ready",
      startServerReadyTimeout: 120_000,
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
