import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Vercel Services does not support Edge Function outputs. Prefer Node middleware.
// (Default Next.js middleware is Edge; Services rejects that as "middleware" Edge output.)
export const runtime = "nodejs";

export async function middleware(request: NextRequest) {
  // Skew Protection: propagate the __vdpl deployment cookie on every response
  // so Next.js can detect version mismatch between client bundles and the server.
  // On Vercel this is handled automatically; this header ensures the cookie is
  // forwarded even through edge caching layers.
  const response = await updateSession(request);

  // Pass through the skew-protection deployment cookie if Vercel injected it.
  const skewCookie = request.cookies.get("__vdpl");
  if (skewCookie) {
    (response as NextResponse).cookies.set("__vdpl", skewCookie.value, {
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - image files
     * - /oci (Vercel container service — routed outside the Next.js web service)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|oci(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
