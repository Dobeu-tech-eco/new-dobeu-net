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
import type { EstimateResult } from "@/lib/pricing/estimate";

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

// ---- estimate templates (Typeform scope intake) ----

export interface EstimateTemplateContact {
  email: string;
  name?: string | null;
  company?: string | null;
}

/** Dollars -> the cents that `formatCurrency` expects. */
function usd(dollars: number): string {
  return formatCurrency(Math.round(dollars) * 100);
}

const CONFIDENCE_COPY: Record<string, string> = {
  firm: "Your answers were specific, so this range is tight.",
  indicative:
    "A few answers were still open, so this range is wider than it would be after a scoping call.",
  rough:
    "Several answers were still to be determined, so treat this as a planning range rather than a quote."
};

/**
 * Client-facing estimate. Leads with the range, explains what moves it, and
 * links to the itemized breakdown. Deliberately never claims to be a quote —
 * the intake's own acknowledgement question sets the same expectation.
 */
export function estimateToClient(args: {
  contact: EstimateTemplateContact;
  estimate: EstimateResult;
  token: string;
}): EmailContent {
  const { contact, estimate, token } = args;
  const url = `${getSiteUrl()}/estimate/${token}`;
  const who = contact.name?.trim().split(/\s+/)[0] || "there";
  const range = `${usd(estimate.low)} – ${usd(estimate.high)}`;
  const confidenceNote = CONFIDENCE_COPY[estimate.confidence] ?? CONFIDENCE_COPY["indicative"]!;
  const retainer = estimate.monthlyRetainer
    ? `${usd(estimate.monthlyRetainer.low)} – ${usd(estimate.monthlyRetainer.high)} per month`
    : null;

  const subject = `Your preliminary estimate: ${range}`;

  const text = [
    `Hi ${who},`,
    "",
    `Based on what you told us, this project lands in the range ${range}.`,
    "",
    confidenceNote,
    ...(retainer ? ["", `Ongoing support would run ${retainer} on top of the build.`] : []),
    "",
    `Full breakdown: ${url}`,
    "",
    "This is a planning estimate, not a proposal. Final scope, fixed price, and terms are confirmed only after we talk and you accept in writing.",
    "",
    "— Jeremy, Dobeu Tech Solutions"
  ].join("\n");

  const retainerHtml = retainer
    ? `<p style="margin:0 0 16px;">Ongoing support would run <strong>${escapeHtml(retainer)}</strong> on top of the build.</p>`
    : "";

  const html = shell(
    `<h1 style="margin:0 0 8px;font-size:22px;">Your preliminary estimate</h1>
<p style="margin:0 0 20px;color:${DOBEU_MUTED};">Hi ${escapeHtml(who)} — here is where your project lands.</p>
<div style="margin:0 0 20px;padding:20px;border:1px solid ${DOBEU_BORDER};border-radius:12px;background:#FAFAFB;text-align:center;">
  <div style="font-size:28px;font-weight:800;letter-spacing:-0.01em;">${escapeHtml(range)}</div>
  <div style="margin-top:6px;font-size:13px;color:${DOBEU_MUTED};text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(estimate.confidence)} range &middot; approx. ${escapeHtml(String(estimate.totalHours))} hours</div>
</div>
<p style="margin:0 0 16px;">${escapeHtml(confidenceNote)}</p>
${retainerHtml}
${button(url, "See the full breakdown")}
<p style="margin:20px 0 0;font-size:13px;color:${DOBEU_MUTED};">This is a planning estimate, not a proposal. Final scope, fixed price, and terms are confirmed only after we talk and you accept in writing.</p>`,
    { previewText: `Preliminary estimate: ${range}` }
  );

  return { subject, text, html };
}

/** Internal notification. Carries the breakdown, the flags, and the free text. */
export function estimateAdminNotification(args: {
  contact: EstimateTemplateContact;
  estimate: EstimateResult;
  token: string;
  narrative?: Record<string, string | null>;
  labels?: Record<string, readonly string[]>;
}): EmailContent {
  const { contact, estimate, token, narrative = {}, labels = {} } = args;
  const url = `${getSiteUrl()}/estimate/${token}`;
  const who = contact.name?.trim() || contact.email;
  const company = contact.company?.trim();
  const range = `${usd(estimate.low)} – ${usd(estimate.high)}`;

  const subject = `Estimate ${range} — ${company || who} (${estimate.track}, budget ${estimate.budgetFit})`;

  const answerLines = Object.entries(labels).map(
    ([field, values]) => `  ${field}: ${values.join(", ")}`
  );
  const narrativeLines = Object.entries(narrative)
    .filter(([, value]) => Boolean(value))
    .map(([field, value]) => `  ${field}: ${value}`);
  const lineItemLines = estimate.lineItems.map(
    (entry) => `  ${entry.label} — ${entry.hours}h ${entry.discipline} = ${usd(entry.amount)}`
  );

  const text = [
    `${who}${company ? ` · ${company}` : ""} · ${contact.email}`,
    `Track: ${estimate.track} · Confidence: ${estimate.confidence} · Budget fit: ${estimate.budgetFit}`,
    `Range: ${range} (mid ${usd(estimate.midpoint)}) · ${estimate.totalHours}h · rate card ${estimate.rateCardVersion}`,
    "",
    ...(estimate.reviewFlags.length ? ["FLAGS:", ...estimate.reviewFlags.map((f) => `  - ${f}`), ""] : []),
    "LINE ITEMS:",
    ...lineItemLines,
    "",
    ...(estimate.multipliers.length
      ? ["MULTIPLIERS:", ...estimate.multipliers.map((m) => `  ${m.label} x${m.factor}`), ""]
      : []),
    ...(narrativeLines.length ? ["WHAT THEY WROTE:", ...narrativeLines, ""] : []),
    ...(answerLines.length ? ["ANSWERS:", ...answerLines, ""] : []),
    url
  ].join("\n");

  const flagsHtml = estimate.reviewFlags.length
    ? `<div style="margin:0 0 18px;padding:14px 16px;border-left:3px solid ${DOBEU_AMBER};background:#FFFBEB;border-radius:6px;">
${estimate.reviewFlags.map((flag) => `<div style="margin:0 0 6px;font-size:14px;">${escapeHtml(flag)}</div>`).join("")}
</div>`
    : "";

  const rows = estimate.lineItems
    .map(
      (entry) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid ${DOBEU_BORDER};font-size:14px;">${escapeHtml(entry.label)}</td>
<td style="padding:6px 0;border-bottom:1px solid ${DOBEU_BORDER};font-size:14px;color:${DOBEU_MUTED};text-align:right;white-space:nowrap;">${entry.hours}h &middot; ${escapeHtml(usd(entry.amount))}</td></tr>`
    )
    .join("");

  const narrativeHtml = narrativeLines.length
    ? `<h2 style="margin:22px 0 8px;font-size:15px;">What they wrote</h2>
${Object.entries(narrative)
  .filter(([, value]) => Boolean(value))
  .map(
    ([field, value]) =>
      `<p style="margin:0 0 10px;font-size:14px;"><span style="color:${DOBEU_MUTED};">${escapeHtml(field)}:</span> ${escapeHtml(value)}</p>`
  )
  .join("")}`
    : "";

  const html = shell(
    `<h1 style="margin:0 0 4px;font-size:20px;">${escapeHtml(range)}</h1>
<p style="margin:0 0 18px;color:${DOBEU_MUTED};font-size:14px;">${escapeHtml(who)}${company ? ` &middot; ${escapeHtml(company)}` : ""} &middot; ${escapeHtml(contact.email)}<br/>
${escapeHtml(estimate.track)} track &middot; ${escapeHtml(estimate.confidence)} &middot; budget ${escapeHtml(estimate.budgetFit)} &middot; ${escapeHtml(String(estimate.totalHours))}h &middot; rate card ${escapeHtml(estimate.rateCardVersion)}</p>
${flagsHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
${narrativeHtml}
${button(url, "Open the estimate")}`,
    { previewText: `${range} — ${company || who}` }
  );

  return { subject, text, html };
}
