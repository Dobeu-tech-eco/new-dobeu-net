import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
    // Never verify an OTP on GET: a mail scanner or a crafted link would
    // consume or plant a session. Hand off to an explicit confirm step.
    const confirm = new URL("/auth/confirm", url.origin);
    confirm.searchParams.set("token_hash", url.searchParams.get("token_hash") ?? "");
    confirm.searchParams.set("type", url.searchParams.get("type") ?? "");
    confirm.searchParams.set("next", next);
    return NextResponse.redirect(confirm);
  }

  return NextResponse.redirect(
    new URL("/login?error=auth_callback_failed", url.origin),
  );
}
