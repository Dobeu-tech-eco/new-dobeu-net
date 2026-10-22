import { NextResponse } from "next/server";
import { withCron } from "@/lib/cron/auth";
import { runCleanup } from "@/lib/cron/cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withCron(async (client) => {
  const summary = await runCleanup(client);
  return NextResponse.json(summary, {
    status: summary.failedTargets.length > 0 ? 500 : 200,
  });
});
