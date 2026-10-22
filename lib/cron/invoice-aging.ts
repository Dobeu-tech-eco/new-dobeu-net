import type { createAdminClient } from "@/lib/supabase/server";
import { logToDatadog } from "@/lib/datadog-server";
import { sendEmail } from "@/lib/resend";
import { invoiceAgingToAdmin } from "@/lib/resend-templates";

type AdminClient = ReturnType<typeof createAdminClient>;
const DAY_MS = 86_400_000;
const PAGE_SIZE = 1000;

export async function runInvoiceAging(client: AdminClient, now = new Date()) {
  // due_date is a SQL date; use UTC calendar days, independent of invocation time.
  const today = now.toISOString().slice(0, 10);
  const midnight = Date.parse(`${today}T00:00:00.000Z`);
  const summary = {
    overdue: 0,
    over7: 0,
    over14: 0,
    over30: 0,
    emailSent: false,
  };

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from("invoices")
      .select("id, due_date")
      .in("status", ["open", "overdue"])
      .lt("due_date", today)
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error || !data) throw new Error("Invoice aging query failed");

    for (const invoice of data) {
      if (!invoice.due_date) continue;
      const days =
        (midnight - Date.parse(`${invoice.due_date}T00:00:00.000Z`)) / DAY_MS;
      if (!(days > 0)) continue;
      summary.overdue++;
      // Cumulative thresholds: a 31-day invoice appears in all three counts.
      if (days > 7) summary.over7++;
      if (days > 14) summary.over14++;
      if (days > 30) summary.over30++;
    }
    if (data.length < PAGE_SIZE) break;
  }

  const admins = [
    ...new Set(
      (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (summary.overdue > 0 && admins.length > 0) {
    try {
      const result = await sendEmail({
        to: admins,
        ...invoiceAgingToAdmin(summary),
      });
      summary.emailSent = result.ok;
      if (!result.ok) await logToDatadog("warn", "Invoice aging email failed");
    } catch {
      await logToDatadog("warn", "Invoice aging email failed");
    }
  } else if (summary.overdue > 0) {
    await logToDatadog(
      "warn",
      "Invoice aging email skipped: ADMIN_EMAILS not configured",
    );
  }
  await logToDatadog("info", "Invoice aging completed", { ...summary });
  return summary;
}
