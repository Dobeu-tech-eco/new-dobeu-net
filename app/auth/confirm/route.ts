import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/utils";
import { otpParamsSchema } from "./schema";
import { OTP_COOKIE, OTP_COOKIE_PATH } from "./cookie";

export const dynamic = "force-dynamic";

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0 && part.slice(0, idx).trim() === name) {
      return part.slice(idx + 1).trim();
    }
  }
  return null;
}

function sameOriginRequest(request: Request, origin: string): boolean {
  const reqOrigin = request.headers.get("origin");
  if (reqOrigin !== null) return reqOrigin === origin;
  const site = request.headers.get("sec-fetch-site");
  return site === "same-origin" || site === "none";
}

function clear<T extends NextResponse>(res: T): T {
  res.cookies.set(OTP_COOKIE, "", { path: OTP_COOKIE_PATH, maxAge: 0 });
  return res;
}

function fail(origin: string) {
  return clear(
    NextResponse.redirect(new URL("/login?error=auth_callback_failed", origin), 303),
  );
}

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (!sameOriginRequest(request, origin)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let parsed: ReturnType<typeof otpParamsSchema.safeParse>;
  try {
    const raw = readCookie(request, OTP_COOKIE);
    parsed = otpParamsSchema.safeParse(
      raw ? JSON.parse(decodeURIComponent(raw)) : null,
    );
  } catch {
    return fail(origin);
  }
  if (!parsed.success) return fail(origin);

  const form = await request.formData().catch(() => null);
  const next = sanitizeNextPath(String(form?.get("next") ?? ""), "/portal");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp(parsed.data);
  if (error) return fail(origin);
  return clear(NextResponse.redirect(new URL(next, origin), 303));
}
