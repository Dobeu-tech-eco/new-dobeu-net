import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LightboxProvider } from "@/components/landing/LightboxProvider";

export const metadata: Metadata = {
  title: "Terms",
  alternates: { canonical: "/terms" }
};

export default function TermsPage() {
  return (
    <LightboxProvider>
      <SiteNav />
      <main id="main" className="container max-w-3xl py-16 prose dark:prose-invert">
        <h1>Terms of Use</h1>
        <p>
          <em>Last updated: May 21, 2026.</em>
        </p>
        <p>
          By using dobeu.net (this site, the client portal, or any related services), you agree to
          these terms. If you don&apos;t agree, please don&apos;t use the site.
        </p>

        <h2>Service</h2>
        <p>
          Dobeu Tech Solutions LLC provides custom software, design, and growth-engineering services
          on a project basis. Specific scope, deliverables, payment terms, and IP assignment for each
          engagement live in the signed proposal for that engagement and supersede anything here.
        </p>

        <h2>Use of the site</h2>
        <p>
          Don&apos;t attempt to compromise the site, scrape large volumes of pages, or impersonate
          another client. The client portal is for clients of Dobeu only.
        </p>

        <h2>Payment</h2>
        <p>
          Invoices are payable via Stripe. Disputes can be sent to{" "}
          <a href="mailto:jeremyw@dobeu.net">jeremyw@dobeu.net</a>.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          The site is provided &ldquo;as is&rdquo;. To the maximum extent allowed by law, Dobeu Tech Solutions
          is not liable for indirect, incidental, or consequential damages arising from use of the
          site.
        </p>

        <h2>Changes</h2>
        <p>
          These terms can change. Material changes will be announced via email to current clients
          before taking effect.
        </p>

        <h2>Governing law</h2>
        <p>State of New York, United States.</p>
      </main>
      <SiteFooter />
    </LightboxProvider>
  );
}
