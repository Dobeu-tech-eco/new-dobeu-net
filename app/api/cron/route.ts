import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel Cron target — schedule configured in vercel.json (`0 10 * * *` UTC).
 * Vercel sends Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const expected = Buffer.from(`Bearer ${cronSecret}`, "utf8");
  const actual = Buffer.from(authHeader, "utf8");

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
