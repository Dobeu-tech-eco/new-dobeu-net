/**
 * Portal: single work-order ticket detail (Phase 3).
 *
 * RLS scopes reads to the row owner. "Accept quote" is an explicit form
 * action that fires `acceptWorkOrderQuote`, which in turn triggers Stripe
 * invoice creation via the internal service-role helper.
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AcceptQuoteForm } from "@/components/portal/AcceptQuoteForm";

export const dynamic = "force-dynamic";

const SERVICE_LABELS: Record<string, string> = {
  logo: "Logo",
  website_update: "Website update",
  data_export: "Data export",
  consulting: "Consulting",
  other: "Other"
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal/tickets");

  const { data: ticket } = await supabase
    .from("work_orders")
    .select("*")
    .eq("id", id)
    .single();

  if (!ticket) notFound();

  const { data: attachments } = await supabase
    .from("work_order_attachments")
    .select("id,filename,mime_type,size_bytes,storage_path,uploaded_at")
    .eq("work_order_id", id)
    .order("uploaded_at", { ascending: true });

  let invoice: {
    id: string;
    amount_cents: number;
    status: string;
    hosted_invoice_url: string | null;
  } | null = null;
  if (ticket.invoice_id) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("id,amount_cents,status,hosted_invoice_url")
      .eq("id", ticket.invoice_id)
      .single();
    invoice = inv ?? null;
  }

  // Signed URLs for attachments (5 min validity per spec).
  let signedAttachments: Array<{
    id: string;
    filename: string;
    size_bytes: number | null;
    url: string | null;
  }> = [];
  if (attachments && attachments.length > 0) {
    signedAttachments = await Promise.all(
      attachments.map(async (a) => {
        const { data } = await supabase.storage
          .from("work-order-attachments")
          .createSignedUrl(a.storage_path, 60 * 5);
        return {
          id: a.id,
          filename: a.filename,
          size_bytes: a.size_bytes ?? null,
          url: data?.signedUrl ?? null
        };
      })
    );
  }

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted-foreground">
        <Link
          href="/portal/tickets"
          className="hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          ← All tickets
        </Link>
      </nav>

      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight">{ticket.title}</h1>
          <Badge
            tone={ticket.status === "open" || ticket.status === "quoted" ? "amber" : "indigo"}
            aria-label={`Status: ${ticket.status.replace(/_/g, " ")}`}
          >
            {ticket.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {SERVICE_LABELS[ticket.service_type] ?? ticket.service_type} ·
          Opened {new Date(ticket.created_at).toLocaleDateString()}
        </p>
      </header>

      {ticket.description && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold mb-2">Notes</h2>
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {ticket.description}
          </p>
        </section>
      )}

      {signedAttachments.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold mb-2">Attachments</h2>
          <ul className="space-y-1.5">
            {signedAttachments.map((a) => (
              <li key={a.id} className="text-sm">
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-4 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {a.filename}
                    <span className="sr-only"> (opens in new tab)</span>
                  </a>
                ) : (
                  <span className="text-muted-foreground">{a.filename}</span>
                )}
                <span className="text-muted-foreground ml-2 text-xs">
                  ({a.size_bytes ? `${Math.round(a.size_bytes / 1024)} KB` : "unknown size"})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ticket.status === "quoted" && ticket.quoted_amount_cents && (
        <section className="rounded-lg border border-accent/30 bg-accent/5 p-5">
          <h2 className="font-semibold mb-2">Quote ready</h2>
          <p className="text-3xl font-bold mb-3">
            {formatCurrency(ticket.quoted_amount_cents)}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Accepting locks in the work and issues a Stripe invoice you can pay online.
          </p>
          <AcceptQuoteForm ticketId={ticket.id} amountCents={ticket.quoted_amount_cents} />
        </section>
      )}

      {invoice && (
        <section className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h2 className="font-semibold">Invoice</h2>
          <p className="text-sm">
            {formatCurrency(invoice.amount_cents)} ·{" "}
            <Badge tone={invoice.status === "paid" ? "neutral" : "amber"} aria-label={`Invoice status: ${invoice.status}`}>
              {invoice.status}
            </Badge>
          </p>
          {invoice.hosted_invoice_url && (
            <Button asChild size="sm">
              <a href={invoice.hosted_invoice_url} target="_blank" rel="noreferrer">
                Pay invoice →
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            </Button>
          )}
        </section>
      )}

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-semibold mb-2">Timeline</h2>
        <ul className="text-sm space-y-1.5">
          <li>
            <span className="font-medium">Opened</span> ·{" "}
            <span className="text-muted-foreground">
              {new Date(ticket.created_at).toLocaleString()}
            </span>
          </li>
          {ticket.quoted_at && (
            <li>
              <span className="font-medium">Quoted</span> ·{" "}
              <span className="text-muted-foreground">
                {new Date(ticket.quoted_at).toLocaleString()}
              </span>
            </li>
          )}
          {ticket.accepted_at && (
            <li>
              <span className="font-medium">Accepted</span> ·{" "}
              <span className="text-muted-foreground">
                {new Date(ticket.accepted_at).toLocaleString()}
              </span>
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
