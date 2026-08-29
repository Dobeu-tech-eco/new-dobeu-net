/** @type {import('@lhci/cli').Config} */
module.exports = {
  ci: {
    collect: {
      url: ["http://localhost:3000/", "http://localhost:3000/labs"],
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
      startServerCommand: "pnpm start",
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
