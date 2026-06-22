import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LightboxProvider } from "@/components/landing/LightboxProvider";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Dobeu Tech Solutions LLC — dobeu.net.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LightboxProvider>
      <SiteNav />
      <main id="main" className="container max-w-3xl py-16 prose dark:prose-invert">
        <h1>Terms of Service</h1>
        <p>
          <em>Last updated: June 20, 2026.</em>
        </p>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use
          of dobeu.net, the Dobeu client portal, and any related services
          (collectively, the &ldquo;Services&rdquo;) operated by Dobeu Tech Solutions
          LLC (&ldquo;Dobeu&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
          &ldquo;our&rdquo;), a limited liability company incorporated under the laws
          of the State of New York. By accessing or using the Services you agree to
          be bound by these Terms. If you do not agree, do not use the Services.
        </p>

        <h2>1. Services</h2>
        <p>
          Dobeu provides custom software development, design systems, AI agent
          engineering, and growth-engineering services. The specific scope,
          deliverables, timeline, fees, and intellectual property assignment for each
          client engagement are set out in a separate signed Statement of Work
          (&ldquo;SOW&rdquo;) or proposal that is provided prior to commencement.
          In the event of a conflict between these Terms and an executed SOW, the SOW
          controls.
        </p>

        <h2>2. Eligibility</h2>
        <p>
          You must be at least 18 years old and have the legal capacity to enter into
          a binding contract in your jurisdiction to use the Services. By using the
          Services you represent and warrant that you meet this requirement.
        </p>

        <h2>3. Accounts and the client portal</h2>
        <p>
          Access to the client portal is by invitation only. You are responsible for
          maintaining the confidentiality of your login credentials and for all
          activity that occurs under your account. Notify us immediately at{" "}
          <a href="mailto:jeremyw@dobeu.net">jeremyw@dobeu.net</a> if you suspect
          unauthorized access. We may suspend or terminate your account at any time
          for breach of these Terms.
        </p>
        <p>
          Multi-factor authentication (MFA) is available and strongly recommended.
          We reserve the right to require MFA for access to sensitive portal features.
        </p>

        <h2>4. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>
            Attempt to gain unauthorized access to, compromise, or disrupt the
            Services, servers, or networks associated with the Services.
          </li>
          <li>
            Scrape, crawl, or extract data from the Services in bulk without prior
            written consent.
          </li>
          <li>
            Impersonate another client, Dobeu employee, or any third party.
          </li>
          <li>
            Use the Services to transmit malware, spam, or any content that violates
            applicable law.
          </li>
          <li>
            Reverse engineer, decompile, or disassemble any portion of the Services.
          </li>
        </ul>

        <h2>5. Payments and invoicing</h2>
        <p>
          Fees are as specified in the applicable SOW. Invoices are issued via Stripe
          and are due within the period stated on the invoice (default: net 15 days).
          Late payments accrue interest at 1.5% per month or the maximum rate
          permitted by law, whichever is lower. Dobeu reserves the right to suspend
          work or portal access for overdue invoices. All fees are non-refundable
          unless expressly stated in the SOW.
        </p>
        <p>
          Payment disputes must be submitted in writing to{" "}
          <a href="mailto:jeremyw@dobeu.net">jeremyw@dobeu.net</a> within 10 business
          days of the invoice date.
        </p>

        <h2>6. Intellectual property</h2>
        <p>
          Unless the signed SOW explicitly assigns ownership of deliverables to you,
          all work product, code, designs, and documentation created by Dobeu remain
          the intellectual property of Dobeu Tech Solutions LLC. Most SOWs provide a
          full work-for-hire assignment upon receipt of final payment.
        </p>
        <p>
          You grant Dobeu a limited, non-exclusive licence to use your name, logo,
          and general project description (e.g., &ldquo;built a custom AI agent for
          [Client]&rdquo;) in our portfolio and marketing materials unless you
          request confidentiality in writing before project commencement.
        </p>

        <h2>7. Confidentiality</h2>
        <p>
          Both parties agree to keep confidential any non-public information
          disclosed in connection with an engagement (&ldquo;Confidential
          Information&rdquo;). Confidential Information does not include information
          that is publicly known, independently developed, or required to be disclosed
          by law. This obligation survives termination of the engagement for three (3)
          years.
        </p>

        <h2>8. Disclaimer of warranties</h2>
        <p>
          THE SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
          AVAILABLE&rdquo; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
          INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, AND NON-INFRINGEMENT. DOBEU DOES NOT WARRANT THAT THE
          SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
        </p>

        <h2>9. Limitation of liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, DOBEU TECH SOLUTIONS LLC
          AND ITS MEMBERS, OFFICERS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR
          ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
          INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN
          CONNECTION WITH THESE TERMS OR THE SERVICES, EVEN IF ADVISED OF THE
          POSSIBILITY OF SUCH DAMAGES. IN NO EVENT SHALL DOBEU&apos;S TOTAL LIABILITY
          EXCEED THE FEES PAID BY YOU IN THE THREE (3) MONTHS PRECEDING THE CLAIM.
        </p>

        <h2>10. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless Dobeu Tech Solutions LLC and its
          affiliates, members, officers, and employees from and against any claims,
          liabilities, damages, and expenses (including reasonable attorneys&apos;
          fees) arising out of or related to your use of the Services, your breach of
          these Terms, or your violation of any third-party rights.
        </p>

        <h2>11. Termination</h2>
        <p>
          Either party may terminate an engagement as specified in the applicable SOW.
          Dobeu may terminate your access to the Services immediately, without notice,
          for material breach of these Terms or for non-payment. Upon termination,
          your right to access the client portal ceases. Sections 6, 7, 8, 9, 10,
          and 13 survive termination.
        </p>

        <h2>12. Privacy and data</h2>
        <p>
          Your use of the Services is also governed by our{" "}
          <a href="/privacy">Privacy Policy</a>,{" "}
          <a href="/cookies">Cookie Policy</a>, and (where applicable){" "}
          <a href="/optin/sms">SMS Opt-In Policy</a>, each incorporated herein by
          reference.
        </p>

        <h2>13. Governing law and disputes</h2>
        <p>
          These Terms are governed by the laws of the State of New York, without
          regard to conflict-of-law principles. Any dispute arising under these Terms
          shall be resolved exclusively in the state or federal courts located in
          New York County, New York, and each party consents to personal jurisdiction
          in those courts. For disputes involving amounts under $10,000, either party
          may elect binding arbitration administered by the American Arbitration
          Association under its Commercial Arbitration Rules.
        </p>

        <h2>14. Changes to these Terms</h2>
        <p>
          We may update these Terms at any time. Material changes will be announced
          by email to registered clients at least 14 days before taking effect.
          Continued use of the Services after the effective date constitutes
          acceptance of the revised Terms.
        </p>

        <h2>15. Contact</h2>
        <p>
          Dobeu Tech Solutions LLC &middot; New York, NY &middot;{" "}
          <a href="mailto:jeremyw@dobeu.net">jeremyw@dobeu.net</a>
        </p>
      </main>
      <SiteFooter />
    </LightboxProvider>
  );
}
