// DSN-gated: inert until a Sentry DSN is present in the environment.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,

  tracesSampleRate: 0.1,

  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
});
