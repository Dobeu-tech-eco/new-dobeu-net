import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createIntercomUserJwt } from "@/lib/intercom-jwt";
import { intercomNameFromUser } from "@/lib/intercom";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VISITOR_COOKIE = "dobeu_intercom_visitor";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function GET() {
  if (!process.env.INTERCOM_API_SECRET) {
    return NextResponse.json({ error: "Intercom secure messenger not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let token: string | undefined;
  let newVisitorId: string | undefined;

  if (user) {
    token = createIntercomUserJwt({
      user_id: user.id,
      email: user.email ?? undefined,
      name: intercomNameFromUser(user),
      created_at: user.created_at
        ? Math.floor(new Date(user.created_at).getTime() / 1000)
        : undefined
    });
  } else {
    const jar = await cookies();
    let visitorId = jar.get(VISITOR_COOKIE)?.value;
    if (!visitorId) {
      visitorId = randomUUID();
      newVisitorId = visitorId;
    }
    token = createIntercomUserJwt({ user_id: visitorId });
  }

  if (!token) {
    return NextResponse.json({ error: "Failed to sign Intercom JWT" }, { status: 500 });
  }

  const res = NextResponse.json({ token });
  if (newVisitorId) {
    res.cookies.set(VISITOR_COOKIE, newVisitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VISITOR_MAX_AGE
    });
  }
  return res;
}
