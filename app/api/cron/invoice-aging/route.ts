import { NextResponse } from "next/server";
import { withCron } from "@/lib/cron/auth";
import { runInvoiceAging } from "@/lib/cron/invoice-aging";
import { logToDatadog } from "@/lib/datadog-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = withCron(async (client) => {
  try {
    const summary = await runInvoiceAging(client);
    // An undelivered alert for real overdue invoices must fail the run.
    return NextResponse.json(summary, {
      status: summary.overdue > 0 && !summary.emailSent ? 500 : 200,
    });
  } catch {
    await logToDatadog("error", "Invoice aging failed");
    return NextResponse.json(
      { error: "invoice_aging_failed" },
      { status: 500 },
    );
  }
});
