import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  // Security: Prevent open redirect by ensuring `next` is a local path.
  let next = url.searchParams.get("next") ?? "/portal";
  if (!next.startsWith("/") || next.startsWith("//")) {
    next = "/portal";
  }

  // Security: Prevent open redirect by ensuring `next` is a local path
  const isLocal = next.startsWith("/") && !next.startsWith("//");
  const safeNext = isLocal ? next : "/portal";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, url.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=auth_callback_failed", url.origin),
  );
}
