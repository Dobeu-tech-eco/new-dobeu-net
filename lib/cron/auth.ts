import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export function verifyCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.get("Authorization");
  if (!secret || !authorization) return false;

  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const actual = Buffer.from(authorization, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function withCron(
  handler: (client: ReturnType<typeof createAdminClient>) => Promise<Response>,
) {
  return async (req: Request) => {
    if (!verifyCronRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let client: ReturnType<typeof createAdminClient>;
    try {
      client = createAdminClient();
    } catch {
      return NextResponse.json({ error: "not_configured" }, { status: 503 });
    }
    return handler(client);
  };
}
