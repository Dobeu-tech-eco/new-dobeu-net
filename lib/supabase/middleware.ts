import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { isAdminEmail } from "@/lib/utils";

/**
 * Refresh the Supabase session on every request so server components see fresh auth.
 * Also enforces /portal and /admin gating in one place.
 *
 * If Supabase env vars are missing (e.g., before the project is provisioned),
 * fall through without crashing so the marketing landing still renders.
 */
export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_VERCEL_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;

  // Bail gracefully if Supabase isn't configured yet
  if (!supabaseUrl || !supabaseAnonKey) {
    if (path.startsWith("/portal") || path.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "supabase_not_configured");
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Gate /portal — must be authenticated
  if (path.startsWith("/portal") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Gate /admin — must be authenticated AND email in ADMIN_EMAILS
  if (path.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
    // Single source of truth for the admin gate — keep parsing centralised
    // in lib/utils so middleware, server actions, and admin layout never drift.
    if (!isAdminEmail(user.email)) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal";
      url.searchParams.set("error", "not_authorized");
      return NextResponse.redirect(url);
    }
  }

  return response;
}
