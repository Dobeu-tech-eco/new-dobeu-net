// Sentry browser-side instrumentation (Turbopack-compatible location, replaces
// the deprecated sentry.client.config.ts). DSN-gated: inert until
// NEXT_PUBLIC_SENTRY_DSN is present in the environment.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,

  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],

  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
});

// Required by Sentry to capture client-side router transitions in App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
