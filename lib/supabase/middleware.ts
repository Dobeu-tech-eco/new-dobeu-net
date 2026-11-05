import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COMPANY_PATH_HEADER } from "@/lib/company-path";
import type { Database } from "@/lib/database.types";
import {
  isAdminEmail,
  requiresAal2Stepup,
  requiresMfaEnrollment,
  sanitizeNextPath,
} from "@/lib/utils";

/**
 * Signed-out redirect to /login. A server-action POST (method POST plus a
 * `next-action` header) gets a 303 carrying `x-action-redirect` and no
 * `Location`, which the Next client turns into a navigation; a 307 would be
 * followed to HTML and surface as an error boundary. Everything else keeps the
 * plain 307 redirect.
 */
function signedOutRedirect(
  request: NextRequest,
  path: string,
  fallback: string,
  keepSearch: boolean,
) {
  if (request.method === "POST" && request.headers.has("next-action")) {
    const next = sanitizeNextPath(path + request.nextUrl.search, fallback);
    const target = `/login?${new URLSearchParams({ next }).toString()}`;
    return new NextResponse(null, {
      status: 303,
      headers: { "x-action-redirect": `${target};push` },
    });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  if (keepSearch) {
    url.search = "";
    url.searchParams.set("next", path + request.nextUrl.search);
  } else {
    url.searchParams.set("next", path);
  }
  return NextResponse.redirect(url);
}

/**
 * Refresh the Supabase session on every request so server components see fresh auth.
 * Also enforces /portal, /admin and /company gating in one place. /company is
 * sign-in only here; company-admin rank, active company and AAL2 are enforced by
 * the /company layout, each /company page, and requireCompanyAdmin(). Signed-out
 * server-action POSTs get a 303 with `x-action-redirect` instead of a 307.
 *
 * If Supabase env vars are missing (e.g., before the project is provisioned),
 * fall through without crashing so the marketing landing still renders.
 */
export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_VERCEL_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;
  const isCompanyPath = path === "/company" || path.startsWith("/company/");

  // Never trust an inbound value: drop it, then forward only our own.
  request.headers.delete(COMPANY_PATH_HEADER);
  if (isCompanyPath) {
    request.headers.set(COMPANY_PATH_HEADER, path + request.nextUrl.search);
  }

  // Defensive auth-code rescue: Supabase appends the PKCE `?code=` to its
  // configured Site URL when the requested `redirect_to` isn't in the Redirect
  // URLs allowlist. That drops the user on `/?code=...` (or any non-callback
  // path) instead of `/auth/callback`, so the session is never exchanged.
  // Forward any stray `code` to the real callback (preserving `next`) so auth
  // completes even if the Supabase dashboard allowlist is misconfigured.
  // Same rescue for a stray OTP `token_hash` (invite / magic-link email
  // templates): /auth/callback moves it into a short-lived Lax, path-scoped cookie so it
  // never sits in a page URL where analytics or Referer could pick it up.
  const strayCode = request.nextUrl.searchParams.get("code");
  const strayToken = request.nextUrl.searchParams.get("token_hash");
  if ((strayCode || strayToken) && path !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  // Bail gracefully if Supabase isn't configured yet
  if (!supabaseUrl || !supabaseAnonKey) {
    if (path.startsWith("/portal") || path.startsWith("/admin") || isCompanyPath) {
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
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gate /portal — must be authenticated
  if (path.startsWith("/portal") && !user) {
    return signedOutRedirect(request, path, "/portal", false);
  }

  // Gate /company — authentication only. Membership (company-admin rank) and
  // AAL2 are enforced authoritatively in app/company/layout.tsx; middleware
  // does no AAL or membership lookups here. `next` keeps the full path + query.
  if (isCompanyPath && !user) {
    return signedOutRedirect(request, path, "/company", true);
  }

  // Gate /admin — must be authenticated AND email in ADMIN_EMAILS AND MFA-satisfied.
  //
  // MFA is MANDATORY for admins. Two cases both redirect to the enrollment page:
  //   1. No verified TOTP factor enrolled → must enroll (requiresMfaEnrollment).
  //   2. A factor exists but the session is still AAL1 → must step up
  //      (requiresAal2Stepup). requiresMfaEnrollment already subsumes this for
  //      admins (currentLevel !== "aal2"), but we OR both for explicitness.
  //
  // Redirect-loop safety: the target `/portal/settings/mfa` lives under
  // `/portal` (gated only on authentication, never on MFA), so the redirected
  // request never re-enters this `/admin` block. `/portal` MUST stay non-MFA-gated.
  if (path.startsWith("/admin")) {
    if (!user) {
      return signedOutRedirect(request, path, "/admin", false);
    }
    if (!isAdminEmail(user.email)) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal";
      url.searchParams.set("error", "not_authorized");
      return NextResponse.redirect(url);
    }
    // MFA enrollment + AAL2 step-up. Fail CLOSED on error (sensitive surface).
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const assurance = aal ?? null;
      if (requiresMfaEnrollment(assurance, true) || requiresAal2Stepup(assurance)) {
        const url = request.nextUrl.clone();
        url.pathname = "/portal/settings/mfa";
        url.searchParams.set("next", path);
        return NextResponse.redirect(url);
      }
    } catch {
      const url = request.nextUrl.clone();
      url.pathname = "/portal/settings/mfa";
      url.searchParams.set("error", "mfa_check_failed");
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
  }

  return response;
}
