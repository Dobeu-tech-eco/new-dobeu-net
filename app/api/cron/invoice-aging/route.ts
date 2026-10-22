import { NextResponse } from "next/server";
import { withCron } from "@/lib/cron/auth";
import { runInvoiceAging } from "@/lib/cron/invoice-aging";
import { logToDatadog } from "@/lib/datadog-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withCron(async (client) => {
  try {
    return NextResponse.json(await runInvoiceAging(client));
  } catch {
    await logToDatadog("error", "Invoice aging failed");
    return NextResponse.json(
      { error: "invoice_aging_failed" },
      { status: 500 },
    );
  }
});
