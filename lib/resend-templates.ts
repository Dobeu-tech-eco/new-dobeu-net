/**
 * Brand-aligned email templates (Phase 3).
 *
 * Each template is a pure function returning `{ subject, text, html }`.
 * Pure-function shape lets callers pipe straight into `sendEmail({ ...tpl })`
 * and lets tests assert on plain output instead of mocking the SDK twice.
 *
 * Visual language: Nunito body, slate-indigo headings, amber CTA, signed
 * "— Jeremy, Dobeu Tech Solutions". URLs route through `getSiteUrl()` so
 * preview/staging envs render the right hostname.
 */
import { getSiteUrl, formatCurrency } from "@/lib/utils";

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

/** Inline escape so untrusted strings can't smuggle markup into emails. */
export function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]!
  );
}

// ---- shared HTML chrome ----

const DOBEU_INDIGO = "#1A1A2E";
const DOBEU_AMBER = "#F59E0B";
const DOBEU_MUTED = "#6B7280";
const DOBEU_BORDER = "#E5E7EB";

function shell(body: string, opts: { previewText?: string } = {}): string {
  const preview = opts.previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(opts.previewText)}</div>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Nunito','Segoe UI',Roboto,-apple-system,BlinkMacSystemFont,sans-serif;color:${DOBEU_INDIGO};line-height:1.55;">
${preview}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${DOBEU_BORDER};border-radius:14px;overflow:hidden;">
<tr><td style="padding:28px 32px 8px;">
<div style="font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${DOBEU_AMBER};">dobeu tech solutions</div>
</td></tr>
<tr><td style="padding:8px 32px 28px;">${body}
<p style="margin:28px 0 0;color:${DOBEU_MUTED};font-size:13px;border-top:1px solid ${DOBEU_BORDER};padding-top:16px;">
— Jeremy, Dobeu Tech Solutions<br/>
<a href="${getSiteUrl()}" style="color:${DOBEU_MUTED};">dobeu.net</a>
</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:${DOBEU_INDIGO};color:#FFFFFF;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;">${escapeHtml(label)}</a></p>`;
}

// ---- work-order templates ----

export interface WorkOrderTemplateInput {
  id: string;
  title: string;
  service_type: string;
  description?: string | null;
  status?: string | null;
}

export function workOrderReceivedToAdmin(args: {
  workOrder: WorkOrderTemplateInput;
  client: { email: string; name?: string | null; company?: string | null };
}): EmailContent {
  const { workOrder: wo, client } = args;
  const adminUrl = `${getSiteUrl()}/admin/tickets/${wo.id}`;
  const who = client.name?.trim() || client.email;
  const subject = `New ticket: ${wo.title} (${wo.service_type})`;
  const text = [
    `${who} submitted a new ticket.`,
    ``,
    `Service: ${wo.service_type}`,
    `Title:   ${wo.title}`,
    wo.description ? `Notes:   ${wo.description}` : null,
    ``,
    `Open: ${adminUrl}`
  ]
    .filter(Boolean)
    .join("\n");
  const html = shell(
    `
<h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:${DOBEU_INDIGO};">New ticket from ${escapeHtml(who)}</h1>
<p style="margin:0 0 8px;">Service type: <strong>${escapeHtml(wo.service_type)}</strong></p>
<p style="margin:0 0 8px;">Title: <strong>${escapeHtml(wo.title)}</strong></p>
${wo.description ? `<p style="margin:0 0 8px;color:${DOBEU_MUTED};white-space:pre-line;">${escapeHtml(wo.description)}</p>` : ""}
${button(adminUrl, "Open in admin →")}`,
    { previewText: `${who}: ${wo.title}` }
  );
  return { subject, text, html };
}

export function workOrderQuoteSentToClient(args: {
  workOrder: WorkOrderTemplateInput;
  amountCents: number;
}): EmailContent {
  const { workOrder: wo, amountCents } = args;
  const portalUrl = `${getSiteUrl()}/portal/tickets/${wo.id}`;
  const amount = formatCurrency(amountCents);
  const subject = `Quote ready: ${wo.title} — ${amount}`;
  const text = [
    `Your quote is ready.`,
    ``,
    `${wo.title} (${wo.service_type})`,
    `Amount: ${amount}`,
    ``,
    `Review and accept: ${portalUrl}`
  ].join("\n");
  const html = shell(
    `
<h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:${DOBEU_INDIGO};">Your quote is ready</h1>
<p style="margin:0 0 8px;">For <strong>${escapeHtml(wo.title)}</strong> (${escapeHtml(wo.service_type)}):</p>
<p style="margin:0 0 8px;font-size:28px;font-weight:800;color:${DOBEU_AMBER};">${escapeHtml(amount)}</p>
<p style="margin:0 0 8px;color:${DOBEU_MUTED};">Accept to confirm; we'll issue a Stripe invoice you can pay online.</p>
${button(portalUrl, "Review & accept →")}`,
    { previewText: `Quote: ${amount}` }
  );
  return { subject, text, html };
}

export function workOrderAcceptedToAdmin(args: {
  workOrder: WorkOrderTemplateInput;
}): EmailContent {
  const { workOrder: wo } = args;
  const adminUrl = `${getSiteUrl()}/admin/tickets/${wo.id}`;
  const subject = `Quote accepted: ${wo.title}`;
  const text = `Client accepted the quote for "${wo.title}". Open: ${adminUrl}`;
  const html = shell(
    `
<h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:${DOBEU_INDIGO};">Quote accepted</h1>
<p style="margin:0 0 8px;"><strong>${escapeHtml(wo.title)}</strong> is locked in.</p>
<p style="margin:0 0 8px;color:${DOBEU_MUTED};">Phase 3 wires invoice creation automatically — you should see the invoice link land shortly.</p>
${button(adminUrl, "Open ticket →")}`,
    { previewText: `Accepted: ${wo.title}` }
  );
  return { subject, text, html };
}

export function workOrderStatusChangedToClient(args: {
  workOrder: WorkOrderTemplateInput;
  newStatus: string;
}): EmailContent {
  const { workOrder: wo, newStatus } = args;
  const portalUrl = `${getSiteUrl()}/portal/tickets/${wo.id}`;
  const human = humanStatus(newStatus);
  const subject = `Update: ${wo.title} — ${human}`;
  const text = `Status update for "${wo.title}": ${human}. ${portalUrl}`;
  const html = shell(
    `
<h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:${DOBEU_INDIGO};">${escapeHtml(human)}</h1>
<p style="margin:0 0 8px;">Your ticket <strong>${escapeHtml(wo.title)}</strong> moved to <strong>${escapeHtml(newStatus)}</strong>.</p>
${button(portalUrl, "View ticket →")}`,
    { previewText: `Status: ${human}` }
  );
  return { subject, text, html };
}

function humanStatus(s: string): string {
  switch (s) {
    case "in_progress":
      return "Work has started";
    case "delivered":
      return "Delivered for review";
    case "closed":
      return "Closed — thanks!";
    case "cancelled":
      return "Cancelled";
    case "accepted":
      return "Quote accepted";
    case "quoted":
      return "Quote ready";
    default:
      return s;
  }
}

// ---- invoice templates ----

export interface InvoiceTemplateInput {
  id: string;
  amount_cents: number;
  currency?: string | null;
  hosted_invoice_url?: string | null;
}

export function invoiceReadyToClient(args: {
  invoice: InvoiceTemplateInput;
  hostedUrl: string;
  description?: string | null;
}): EmailContent {
  const { invoice: inv, hostedUrl, description } = args;
  const amount = formatCurrency(inv.amount_cents, inv.currency ?? "USD");
  const subject = `Invoice ready — ${amount}`;
  const text = [
    `Your invoice is ready.`,
    description ? `For: ${description}` : null,
    `Amount: ${amount}`,
    ``,
    `Pay online: ${hostedUrl}`
  ]
    .filter(Boolean)
    .join("\n");
  const html = shell(
    `
<h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:${DOBEU_INDIGO};">Invoice ready</h1>
${description ? `<p style="margin:0 0 8px;">For: ${escapeHtml(description)}</p>` : ""}
<p style="margin:0 0 8px;font-size:28px;font-weight:800;color:${DOBEU_AMBER};">${escapeHtml(amount)}</p>
${button(hostedUrl, "Pay invoice →")}
<p style="margin:12px 0 0;color:${DOBEU_MUTED};font-size:12px;">Stripe also sends you a copy of this link. Either link works.</p>`,
    { previewText: `Invoice for ${amount}` }
  );
  return { subject, text, html };
}

export function invoicePaidToClient(args: {
  invoice: InvoiceTemplateInput;
  description?: string | null;
}): EmailContent {
  const { invoice: inv, description } = args;
  const amount = formatCurrency(inv.amount_cents, inv.currency ?? "USD");
  const subject = `Payment received — thank you`;
  const text = `Payment received for ${amount}. Thank you!`;
  const html = shell(
    `
<h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:${DOBEU_INDIGO};">Payment received</h1>
<p style="margin:0 0 8px;">Thanks — your payment of <strong>${escapeHtml(amount)}</strong> went through.</p>
${description ? `<p style="margin:0 0 8px;color:${DOBEU_MUTED};">${escapeHtml(description)}</p>` : ""}
<p style="margin:0 0 8px;color:${DOBEU_MUTED};">A receipt from Stripe should be in your inbox shortly.</p>`,
    { previewText: `Thanks for the ${amount} payment` }
  );
  return { subject, text, html };
}

export function invoicePaymentFailedToAdmin(args: {
  invoice: InvoiceTemplateInput;
  stripeInvoiceId?: string | null;
}): EmailContent {
  const { invoice: inv, stripeInvoiceId } = args;
  const amount = formatCurrency(inv.amount_cents, inv.currency ?? "USD");
  const adminUrl = `${getSiteUrl()}/admin/invoices`;
  const stripeLink = stripeInvoiceId
    ? `https://dashboard.stripe.com/invoices/${stripeInvoiceId}`
    : null;
  const subject = `Payment failed: ${amount}`;
  const text = [
    `Stripe reports a failed payment of ${amount}.`,
    `Local invoice: ${inv.id}`,
    stripeLink ? `Stripe dashboard: ${stripeLink}` : null,
    `Admin: ${adminUrl}`
  ]
    .filter(Boolean)
    .join("\n");
  const html = shell(
    `
<h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:${DOBEU_INDIGO};">Payment failed</h1>
<p style="margin:0 0 8px;">Stripe rejected a payment of <strong>${escapeHtml(amount)}</strong>.</p>
<p style="margin:0 0 8px;color:${DOBEU_MUTED};">Local invoice id: <code>${escapeHtml(inv.id)}</code></p>
${stripeLink ? button(stripeLink, "Open in Stripe →") : ""}
${button(adminUrl, "Admin invoices →")}`,
    { previewText: `Payment failed: ${amount}` }
  );
  return { subject, text, html };
}

// ---- lead templates (Phase 2c — hoisted from lib/leads.ts) ----

export function leadConfirmationToClient(args: {
  name?: string | null;
  source: string;
}): EmailContent {
  const greeting = args.name?.trim() || "there";
  const subject = "Got it — I'll be in touch shortly";
  const text = [
    `Hey ${greeting} —`,
    ``,
    `Got your note. I personally read every inquiry and reply within 24 hours (usually faster).`,
    `If you booked a call, expect a calendar invite shortly. Otherwise, I'll be in touch with next steps.`,
    ``,
    `— Jeremy, Dobeu Tech Solutions`
  ].join("\n");
  const html = shell(
    `
<h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:${DOBEU_INDIGO};">Hey ${escapeHtml(greeting)} —</h1>
<p style="margin:0 0 12px;">Got your note. I personally read every inquiry and reply within 24 hours (usually faster).</p>
<p style="margin:0 0 8px;">If you booked a call, expect a calendar invite shortly. Otherwise, I'll be in touch with next steps.</p>
<p style="margin:12px 0 0;color:${DOBEU_MUTED};font-size:12px;">Triggered by your <strong>${escapeHtml(args.source)}</strong> submission on dobeu.net.</p>`,
    { previewText: "Got your note — replying within 24h" }
  );
  return { subject, text, html };
}

export function leadAdminNotification(args: {
  email: string;
  name?: string | null;
  company?: string | null;
  message?: string | null;
  source: string;
  utm?: Record<string, string>;
  referrer?: string | null;
}): EmailContent {
  const rows: [string, string][] = [
    ["email", args.email],
    ["name", args.name ?? "—"],
    ["company", args.company ?? "—"],
    ["source", args.source],
    ["referrer", args.referrer ?? "—"]
  ];
  const utm = args.utm ?? {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    if (utm[k]) rows.push([k, utm[k]]);
  }
  if (args.message) rows.push(["message", args.message]);
  const subject = `New lead: ${args.name ?? args.email} (${args.source})`;
  const text = rows.map(([k, v]) => `${k.padEnd(12)} ${v}`).join("\n");
  const tableRows = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;font-weight:700;color:${DOBEU_MUTED};font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(k)}</td><td style="padding:6px 12px;">${escapeHtml(v)}</td></tr>`
    )
    .join("");
  const html = shell(
    `
<h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:${DOBEU_INDIGO};">New lead</h1>
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">${tableRows}</table>`,
    { previewText: `${args.name ?? args.email} (${args.source})` }
  );
  return { subject, text, html };
}
