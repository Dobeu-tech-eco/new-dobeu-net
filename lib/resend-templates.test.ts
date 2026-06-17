import { describe, it, expect, beforeEach } from "vitest";
import {
  escapeHtml,
  workOrderReceivedToAdmin,
  workOrderQuoteSentToClient,
  workOrderAcceptedToAdmin,
  workOrderStatusChangedToClient,
  invoiceReadyToClient,
  invoicePaidToClient,
  invoicePaymentFailedToAdmin,
  leadConfirmationToClient,
  leadAdminNotification
} from "@/lib/resend-templates";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://dobeu.net";
});

describe("escapeHtml", () => {
  it("escapes the five html-significant chars", () => {
    expect(escapeHtml(`<a href="x">&'"</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&quot;&lt;/a&gt;"
    );
  });
  it("coerces nullish to empty string", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

const wo = {
  id: "wo_abc",
  title: "Logo refresh",
  service_type: "logo",
  description: "Need it minimalist <yo>"
};

describe("workOrder templates", () => {
  it("workOrderReceivedToAdmin includes admin link + escapes description", () => {
    const out = workOrderReceivedToAdmin({
      workOrder: wo,
      client: { email: "client@example.com", name: "Alice" }
    });
    expect(out.subject).toMatch(/^New ticket: Logo refresh \(logo\)$/);
    expect(out.text).toContain("Alice submitted a new ticket");
    expect(out.html).toContain("https://dobeu.net/admin/tickets/wo_abc");
    expect(out.html).toContain("&lt;yo&gt;");
    expect(out.html).not.toContain("<yo>");
  });

  it("workOrderQuoteSentToClient renders amount via formatCurrency", () => {
    const out = workOrderQuoteSentToClient({ workOrder: wo, amountCents: 125000 });
    expect(out.subject).toMatch(/Quote ready: Logo refresh — \$1,250/);
    expect(out.html).toContain("https://dobeu.net/portal/tickets/wo_abc");
    expect(out.html).toContain("$1,250");
  });

  it("workOrderAcceptedToAdmin admin link", () => {
    const out = workOrderAcceptedToAdmin({ workOrder: wo });
    expect(out.subject).toMatch(/Quote accepted: Logo refresh/);
    expect(out.html).toContain("/admin/tickets/wo_abc");
  });

  it("workOrderStatusChangedToClient maps human status", () => {
    const out = workOrderStatusChangedToClient({ workOrder: wo, newStatus: "in_progress" });
    expect(out.subject).toContain("Work has started");
    expect(out.text).toContain("Work has started");
  });
});

describe("invoice templates", () => {
  const inv = { id: "inv_1", amount_cents: 25000, currency: "USD" };

  it("invoiceReadyToClient has pay button + amount", () => {
    const out = invoiceReadyToClient({
      invoice: inv,
      hostedUrl: "https://pay.stripe.com/abc",
      description: "Logo retainer"
    });
    expect(out.subject).toContain("$250");
    expect(out.html).toContain("https://pay.stripe.com/abc");
    expect(out.html).toContain("Logo retainer");
  });

  it("invoicePaidToClient says thanks", () => {
    const out = invoicePaidToClient({ invoice: inv });
    expect(out.subject).toMatch(/Payment received/);
    expect(out.html).toContain("$250");
  });

  it("invoicePaymentFailedToAdmin links to Stripe dashboard when stripe id provided", () => {
    const out = invoicePaymentFailedToAdmin({ invoice: inv, stripeInvoiceId: "in_xx" });
    expect(out.subject).toContain("$250");
    expect(out.html).toContain("dashboard.stripe.com/invoices/in_xx");
  });

  it("invoicePaymentFailedToAdmin omits stripe link when id missing", () => {
    const out = invoicePaymentFailedToAdmin({ invoice: inv });
    expect(out.html).not.toContain("dashboard.stripe.com/invoices");
  });
});

describe("lead templates (hoisted)", () => {
  it("leadConfirmationToClient personalizes greeting", () => {
    const out = leadConfirmationToClient({ name: "Bob", source: "form" });
    expect(out.html).toContain("Hey Bob");
    expect(out.text).toContain("Hey Bob");
    expect(out.html).toContain("form");
  });

  it("leadConfirmationToClient falls back to 'there' for unknown name", () => {
    const out = leadConfirmationToClient({ name: null, source: "book" });
    expect(out.html).toContain("Hey there");
  });

  it("leadAdminNotification includes only set UTMs", () => {
    const out = leadAdminNotification({
      email: "alice@example.com",
      name: "Alice",
      company: "Acme",
      source: "form",
      utm: { utm_source: "google", utm_medium: "cpc" },
      referrer: null,
      message: "Need a logo"
    });
    expect(out.subject).toContain("Alice");
    expect(out.html).toContain("utm_source");
    expect(out.html).toContain("google");
    expect(out.html).not.toContain("utm_campaign");
    expect(out.html).toContain("Need a logo");
  });
});
