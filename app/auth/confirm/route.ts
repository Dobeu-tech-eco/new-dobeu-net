import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/utils";
import { otpParamsSchema } from "./schema";

export const dynamic = "force-dynamic";

function fail(origin: string) {
  return NextResponse.redirect(
    new URL("/login?error=auth_callback_failed", origin),
    303,
  );
}

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const form = await request.formData();
  const next = sanitizeNextPath(String(form.get("next") ?? ""), "/portal");
  const parsed = otpParamsSchema.safeParse({
    token_hash: form.get("token_hash"),
    type: form.get("type"),
  });
  if (!parsed.success) return fail(origin);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp(parsed.data);
  if (error) return fail(origin);
  return NextResponse.redirect(new URL(next, origin), 303);
}
