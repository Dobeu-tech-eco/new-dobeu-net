import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/utils";

export const dynamic = "force-dynamic";

const otpParamsSchema = z.object({
  token_hash: z.string().min(1).max(512),
  type: z.enum(["invite", "magiclink", "email", "recovery", "signup"]),
});

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
  } else {
    const parsed = otpParamsSchema.safeParse({
      token_hash: url.searchParams.get("token_hash"),
      type: url.searchParams.get("type"),
    });
    if (parsed.success) {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp(parsed.data);
      if (!error) {
        return NextResponse.redirect(new URL(next, url.origin));
      }
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=auth_callback_failed", url.origin),
  );
}
