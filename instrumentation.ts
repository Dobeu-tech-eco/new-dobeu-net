/**
 * Next.js instrumentation hook.
 *
 * `onRequestError` fires for every uncaught error in Server Components, Route
 * Handlers and Server Actions. Forwarding it to Datadog gives server-side error
 * tracking that correlates with browser RUM by `service` + `version` tags.
 *
 * Inert until DATADOG_API_KEY is set — see lib/datadog-server.ts.
 */
import type { Instrumentation } from "next";

export async function register(): Promise<void> {
  // No agent to boot: Vercel Functions ship logs over HTTP intake / Log Drain.
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context
) => {
  // Fire-and-forget: Next.js awaits a returned Promise, and the intake has a
  // 2s timeout. Do not hold the error response open for Datadog.
  void import("./lib/datadog-server").then(({ logServerError }) =>
    logServerError(error, {
      http: { url: request.path, method: request.method },
      nextjs: {
        routerKind: context.routerKind,
        routePath: context.routePath,
        routeType: context.routeType
      }
    })
  );
};
