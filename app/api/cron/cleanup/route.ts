import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron/auth";
import { runCleanup } from "@/lib/cron/cleanup";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let client: ReturnType<typeof createAdminClient>;
  try {
    client = createAdminClient();
  } catch {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  return NextResponse.json(await runCleanup(client));
}
