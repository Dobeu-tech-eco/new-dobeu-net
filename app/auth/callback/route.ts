import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/utils";
import { otpParamsSchema } from "@/app/auth/confirm/schema";
import { OTP_COOKIE, OTP_COOKIE_PATH } from "@/app/auth/confirm/cookie";

export const dynamic = "force-dynamic";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeNextPath(url.searchParams.get("next"), "/portal");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  } else if (url.searchParams.has("token_hash")) {
    // Never verify an OTP on GET. Park the token in a Lax, httpOnly, path-scoped cookie
    // (so a cross-site POST cannot carry it) and send the browser to a confirm
    // step whose URL holds no token.
    const parsed = otpParamsSchema.safeParse({
      token_hash: url.searchParams.get("token_hash"),
      type: url.searchParams.get("type"),
    });
    if (parsed.success) {
      const confirm = new URL("/auth/confirm", url.origin);
      confirm.searchParams.set("next", next);
      const res = NextResponse.redirect(confirm, 303);
      // Lax, not Strict: the chain starts at an email link (cross-site), and
      // browsers withhold Strict cookies on every hop of a cross-site-initiated
      // navigation, so the confirm page would never see it. Lax is still not
      // sent on a cross-site POST, and the submit route also checks Origin.
      res.cookies.set(OTP_COOKIE, JSON.stringify(parsed.data), {
        httpOnly: true,
        sameSite: "lax",
        secure: !LOCAL_HOSTS.has(url.hostname),
        path: OTP_COOKIE_PATH,
        maxAge: 120,
      });
      return res;
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=auth_callback_failed", url.origin),
  );
}
