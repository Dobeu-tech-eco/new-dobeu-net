import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createIntercomUserJwt } from "@/lib/intercom-jwt";
import { intercomNameFromUser } from "@/lib/intercom";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Legacy cookie from the previous visitor-JWT scheme. Anonymous visitors are
 * no longer signed (that minted an Intercom *User* per visitor); the cookie is
 * cleared when seen so old browsers converge on plain visitor boots.
 */
const LEGACY_VISITOR_COOKIE = "dobeu_intercom_visitor";
const RATE_LIMIT_WINDOW_SEC = 60;
const RATE_LIMIT_MAX = 20;

function getClientIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

export async function GET(req: NextRequest) {
  if (!process.env.INTERCOM_API_SECRET) {
    return NextResponse.json({ error: "Intercom secure messenger not configured" }, { status: 503 });
  }

  const ip = getClientIp(req);
  const { limited } = await checkRateLimit(`intercom-jwt:${ip}`, {
    windowSec: RATE_LIMIT_WINDOW_SEC,
    max: RATE_LIMIT_MAX
  });
  if (limited) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    // Anonymous visitors boot without a JWT so Intercom keeps them as
    // Visitors/Leads. 204 tells IntercomSecureBoot to do a plain boot.
    const res = new NextResponse(null, { status: 204 });
    const jar = await cookies();
    if (jar.get(LEGACY_VISITOR_COOKIE)) {
      res.cookies.set(LEGACY_VISITOR_COOKIE, "", { maxAge: 0, path: "/" });
    }
    return res;
  }

  const token = createIntercomUserJwt({
    user_id: user.id,
    email: user.email ?? undefined,
    name: intercomNameFromUser(user),
    created_at: user.created_at
      ? Math.floor(new Date(user.created_at).getTime() / 1000)
      : undefined
  });

  if (!token) {
    return NextResponse.json({ error: "Failed to sign Intercom JWT" }, { status: 500 });
  }

  return NextResponse.json({ token });
}
