/** Public URL prefix for the OCI container service (vercel.json rewrites). */
export const PUBLIC_PREFIX = "/oci";

/**
 * Map the public URL path to the path container handlers understand.
 * /oci        -> /
 * /oci/       -> /
 * /oci/health -> /health
 * /health     -> /health (local docker run / path-stripped transforms)
 */
export function toServicePath(pathname) {
  if (pathname === PUBLIC_PREFIX || pathname === `${PUBLIC_PREFIX}/`) {
    return "/";
  }
  if (pathname.startsWith(`${PUBLIC_PREFIX}/`)) {
    const rest = pathname.slice(PUBLIC_PREFIX.length);
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return pathname;
}
