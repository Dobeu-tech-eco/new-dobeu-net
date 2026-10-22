import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron/auth";
import { runInvoiceAging } from "@/lib/cron/invoice-aging";
import { createAdminClient } from "@/lib/supabase/server";
import { logToDatadog } from "@/lib/datadog-server";

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
  try {
    return NextResponse.json(await runInvoiceAging(client));
  } catch {
    await logToDatadog("error", "Invoice aging failed");
    return NextResponse.json(
      { error: "invoice_aging_failed" },
      { status: 500 },
    );
  }
}
