/**
 * Minimal custom Function HTTP server for Vercel container images.
 * Listens on PORT (default 80 per Vercel container runtime docs).
 *
 * Public route prefix on the deployment: /oci (see root vercel.json services + rewrites).
 * Vercel may pass the original path (/oci/...) even after service routing, so we strip
 * that prefix before matching handlers. Service-level request.path transforms do the same.
 *
 * @see https://vercel.com/docs/functions/container-images
 * @see https://vercel.com/docs/services/routing
 */

import http from "node:http";
import { toServicePath } from "./path.mjs";

const port = Number(process.env.PORT || 80);
const host = process.env.HOST || "0.0.0.0";

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const path = toServicePath(url.pathname);

  if (req.method === "GET" && (path === "/health" || path === "/healthz")) {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "new-dobeu-net-oci",
        path,
        publicPath: url.pathname,
      }),
    );
    return;
  }

  if (req.method === "GET" && path === "/") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "new-dobeu-net-oci",
        message: "Custom Vercel Function container is running",
        path,
        publicPath: url.pathname,
        method: req.method,
      }),
    );
    return;
  }

  res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify({
      ok: false,
      error: "not_found",
      path,
      publicPath: url.pathname,
    }),
  );
});

function shutdown(signal) {
  console.log(`[oci] received ${signal}, shutting down`);
  server.close(() => {
    process.exit(0);
  });
  // Force exit if graceful close hangs past Vercel's SIGTERM window.
  setTimeout(() => process.exit(1), 25_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(port, host, () => {
  console.log(`[oci] listening on http://${host}:${port}`);
});
