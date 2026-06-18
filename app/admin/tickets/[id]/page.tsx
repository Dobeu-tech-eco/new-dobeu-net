/**
 * Admin: single ticket detail (Phase 3).
 *
 * Service-role reads (RLS bypass). Admin can quote (status=open → quoted),
 * transition status (accepted → in_progress → delivered → closed | cancelled),
 * and inspect the linked invoice if one exists.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminQuoteForm } from "@/components/admin/AdminQuoteForm";
import { AdminStatusButtons } from "@/components/admin/AdminStatusButtons";
import { AdminMarkPaidButton } from "@/components/admin/AdminMarkPaidButton";

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

export default async function AdminTicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: ticket } = await admin.from("work_orders").select("*").eq("id", id).single();
  if (!ticket) notFound();

  const { data: attachments } = await admin
    .from("work_order_attachments")
    .select("id,filename,mime_type,size_bytes,storage_path,uploaded_at")
    .eq("work_order_id", id)
    .order("uploaded_at", { ascending: true });

  // Resolve owner email + name.
  const { data: ownerUser } = await admin.auth.admin.getUserById(ticket.created_by);
  const ownerEmail = ownerUser?.user?.email ?? "(no email)";
  const ownerName =
    (ownerUser?.user?.user_metadata as { full_name?: string } | null)?.full_name ?? null;

  let invoice: {
    id: string;
    amount_cents: number;
    status: string;
    hosted_invoice_url: string | null;
    stripe_invoice_id: string | null;
  } | null = null;
  if (ticket.invoice_id) {
    const { data: inv } = await admin
      .from("invoices")
      .select("id,amount_cents,status,hosted_invoice_url,stripe_invoice_id")
      .eq("id", ticket.invoice_id)
      .single();
    invoice = inv ?? null;
  }

  // Signed URLs for attachments — 5 min validity per spec.
  let signedAttachments: Array<{
    id: string;
    filename: string;
    size_bytes: number | null;
    url: string | null;
  }> = [];
  if (attachments && attachments.length > 0) {
    signedAttachments = await Promise.all(
      attachments.map(async (a) => {
        const { data } = await admin.storage
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
          href="/admin/tickets"
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

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-semibold mb-2">Client</h2>
        <p className="text-sm">{ownerName ?? <span className="text-muted-foreground">(no name)</span>}</p>
        <p className="text-sm text-muted-foreground">{ownerEmail}</p>
      </section>

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

      {ticket.status === "open" && (
        <section className="rounded-lg border border-accent/30 bg-accent/5 p-5 space-y-3">
          <h2 className="font-semibold">Quote this ticket</h2>
          <AdminQuoteForm ticketId={ticket.id} />
        </section>
      )}

      {ticket.status === "quoted" && ticket.quoted_amount_cents && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold mb-2">Quote sent</h2>
          <p className="text-2xl font-bold">{formatCurrency(ticket.quoted_amount_cents)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Quoted {ticket.quoted_at ? new Date(ticket.quoted_at).toLocaleString() : "—"}. Waiting on
            client acceptance.
          </p>
        </section>
      )}

      {(ticket.status === "accepted" ||
        ticket.status === "in_progress" ||
        ticket.status === "delivered") && (
        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Transition status</h2>
          <AdminStatusButtons ticketId={ticket.id} currentStatus={ticket.status} />
        </section>
      )}

      {invoice && (
        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Linked invoice</h2>
          <p className="text-sm">
            {formatCurrency(invoice.amount_cents)} ·{" "}
            <Badge tone={invoice.status === "paid" ? "neutral" : "amber"} aria-label={`Invoice status: ${invoice.status}`}>
              {invoice.status}
            </Badge>
          </p>
          {invoice.hosted_invoice_url && (
            <Button asChild variant="ghost" size="sm">
              <a href={invoice.hosted_invoice_url} target="_blank" rel="noreferrer">
                View Stripe hosted invoice →
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            </Button>
          )}
          {invoice.status !== "paid" && <AdminMarkPaidButton invoiceId={invoice.id} />}
        </section>
      )}
    </div>
  );
}
