import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LightboxProvider } from "@/components/landing/LightboxProvider";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Dobeu Tech Solutions LLC collects, uses, and protects your personal data.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LightboxProvider>
      <SiteNav />
      <main id="main" className="container max-w-3xl py-16 prose dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p>
          <em>Last updated: June 20, 2026.</em>
        </p>
        <p>
          Dobeu Tech Solutions LLC (&ldquo;Dobeu&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo;, or &ldquo;our&rdquo;) operates dobeu.net, the Dobeu client
          portal, and related services. This Privacy Policy describes what personal
          data we collect, why we collect it, how we use and share it, and the rights
          you have over it.
        </p>
        <p>
          This policy applies to all users of dobeu.net, prospective clients, and
          current or former clients who have access to the client portal.
        </p>

        <h2>1. Data we collect</h2>

        <h3>Information you provide directly</h3>
        <ul>
          <li>
            <strong>Contact information</strong> — name, email address, company name,
            phone number, and message content submitted via contact or lead-capture
            forms.
          </li>
          <li>
            <strong>Account credentials</strong> — email and hashed password or
            OAuth token used to authenticate with the client portal.
          </li>
          <li>
            <strong>Project information</strong> — briefs, requirements, files, and
            communications shared in the context of an engagement.
          </li>
          <li>
            <strong>Billing information</strong> — invoice acknowledgement and
            payment intent status. Full card data is collected and processed by
            Stripe and never transmitted to or stored on Dobeu servers.
          </li>
        </ul>

        <h3>Information we collect automatically</h3>
        <ul>
          <li>
            <strong>Usage data</strong> — pages visited, buttons clicked, scroll
            depth, session duration, and referrer URL. Collected via PostHog,
            Mixpanel, and Google Analytics 4 <em>only after you accept the cookie
            banner</em>.
          </li>
          <li>
            <strong>Device and browser data</strong> — browser type, operating
            system, device type, screen resolution, and IP address (anonymised
            where technically possible).
          </li>
          <li>
            <strong>Log data</strong> — server request logs retained by Vercel for
            up to 30 days for security and debugging.
          </li>
          <li>
            <strong>Authentication session</strong> — Supabase session tokens stored
            in httpOnly cookies for the duration of your logged-in session.
          </li>
        </ul>

        <h2>2. Legal basis for processing (GDPR)</h2>
        <p>If you are in the European Economic Area, UK, or Switzerland, we process
        your data under the following legal bases:</p>
        <ul>
          <li>
            <strong>Contract</strong> — processing necessary to deliver our services
            to you (Art. 6(1)(b) GDPR).
          </li>
          <li>
            <strong>Consent</strong> — analytics, support chat, and marketing
            communications, which you opt into via the cookie banner or form
            checkboxes (Art. 6(1)(a) GDPR). You may withdraw consent at any time.
          </li>
          <li>
            <strong>Legitimate interests</strong> — security monitoring, fraud
            prevention, and improving our services, where these interests are not
            overridden by your rights (Art. 6(1)(f) GDPR).
          </li>
          <li>
            <strong>Legal obligation</strong> — compliance with applicable tax,
            accounting, and regulatory requirements (Art. 6(1)(c) GDPR).
          </li>
        </ul>

        <h2>3. How we use your data</h2>
        <ul>
          <li>Respond to your inquiry and deliver agreed work.</li>
          <li>Create and manage your client portal account.</li>
          <li>Issue invoices and process payments via Stripe.</li>
          <li>Send transactional emails (booking confirmations, invoice receipts, project status updates) via Resend.</li>
          <li>Send marketing emails and follow-up sequences via Customer.io, <em>only if you have opted in</em>.</li>
          <li>Send SMS messages for project updates or appointment reminders, <em>only if you have opted in</em> per our <a href="/optin/sms">SMS Opt-In Policy</a>.</li>
          <li>Analyse site usage to improve performance and user experience, <em>only with analytics consent</em>.</li>
          <li>Detect, prevent, and respond to fraud, abuse, or security incidents.</li>
        </ul>
        <p>
          We do not sell personal data. We do not run third-party advertising tags
          or retargeting pixels.
        </p>

        <h2>4. Data sharing and processors</h2>
        <p>
          We share personal data only with the third-party processors listed below,
          each bound by a Data Processing Agreement or equivalent contractual
          protections. We do not share data with any other third parties without
          your explicit consent.
        </p>
        <table>
          <thead>
            <tr>
              <th>Processor</th>
              <th>Purpose</th>
              <th>Data location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Vercel</td>
              <td>Hosting, edge network, log storage</td>
              <td>US (iad1) / global CDN</td>
            </tr>
            <tr>
              <td>Supabase</td>
              <td>Database and authentication</td>
              <td>US-East (AWS)</td>
            </tr>
            <tr>
              <td>Stripe</td>
              <td>Payment processing</td>
              <td>US / EU</td>
            </tr>
            <tr>
              <td>Resend</td>
              <td>Transactional email</td>
              <td>US</td>
            </tr>
            <tr>
              <td>Customer.io</td>
              <td>Marketing email sequences (opt-in only)</td>
              <td>US</td>
            </tr>
            <tr>
              <td>PostHog</td>
              <td>Product analytics (opt-in only)</td>
              <td>US (self-hosted option available)</td>
            </tr>
            <tr>
              <td>Mixpanel</td>
              <td>Event analytics (opt-in only)</td>
              <td>US</td>
            </tr>
            <tr>
              <td>Google Analytics 4</td>
              <td>Traffic analytics (opt-in only)</td>
              <td>US / EU (IP anonymised)</td>
            </tr>
            <tr>
              <td>Apollo.io</td>
              <td>CRM and lead management</td>
              <td>US</td>
            </tr>
            <tr>
              <td>Intercom</td>
              <td>Customer support chat (opt-in only)</td>
              <td>US</td>
            </tr>
            <tr>
              <td>Calendly</td>
              <td>Booking and scheduling</td>
              <td>US</td>
            </tr>
            <tr>
              <td>Typeform</td>
              <td>Lead capture forms</td>
              <td>EU</td>
            </tr>
            <tr>
              <td>Datadog</td>
              <td>Observability and error monitoring (opt-in only)</td>
              <td>US</td>
            </tr>
          </tbody>
        </table>

        <h2>5. International data transfers</h2>
        <p>
          We are based in the United States. If you are located in the EEA, UK, or
          Switzerland, your data may be transferred to and processed in the US. We
          rely on Standard Contractual Clauses (SCCs) approved by the European
          Commission and UK Information Commissioner&apos;s Office (ICO) for such
          transfers, as implemented in the data processing agreements with each of
          our processors above.
        </p>

        <h2>6. Data retention</h2>
        <ul>
          <li>
            <strong>Client project data</strong> — retained for 3 years after project
            completion for warranty and dispute-resolution purposes, then deleted or
            anonymised.
          </li>
          <li>
            <strong>Billing records</strong> — retained for 7 years to comply with
            US tax and accounting obligations.
          </li>
          <li>
            <strong>Analytics data</strong> — retained for 12 months, then
            automatically purged by the respective platform.
          </li>
          <li>
            <strong>Lead / contact form submissions</strong> — retained for 2 years
            or until you request deletion.
          </li>
          <li>
            <strong>Authentication session cookies</strong> — expire after 7 days of
            inactivity.
          </li>
        </ul>

        <h2>7. Your rights</h2>
        <p>
          Depending on your location, you may have the following rights regarding
          your personal data:
        </p>
        <ul>
          <li>
            <strong>Access</strong> — request a copy of the personal data we hold
            about you.
          </li>
          <li>
            <strong>Correction</strong> — request correction of inaccurate or
            incomplete data.
          </li>
          <li>
            <strong>Deletion</strong> — request deletion of your personal data
            (&ldquo;right to be forgotten&rdquo;), subject to legal retention
            obligations.
          </li>
          <li>
            <strong>Portability</strong> — receive your data in a machine-readable
            format.
          </li>
          <li>
            <strong>Objection / restriction</strong> — object to or restrict certain
            processing activities.
          </li>
          <li>
            <strong>Withdraw consent</strong> — withdraw any consent you have given
            at any time without affecting the lawfulness of prior processing.
          </li>
          <li>
            <strong>Opt out of marketing</strong> — see our{" "}
            <a href="/marketing-opt-out">Marketing opt-out</a> page or click
            &ldquo;unsubscribe&rdquo; in any email we send.
          </li>
          <li>
            <strong>Opt out of SMS</strong> — reply STOP to any text message or see
            our <a href="/optin/sms">SMS Opt-In Policy</a>.
          </li>
          <li>
            <strong>Manage cookies</strong> — see our{" "}
            <a href="/cookies">Cookie Policy</a> or click{" "}
            &ldquo;Cookie preferences&rdquo; in the footer.
          </li>
        </ul>
        <p>
          To exercise any of these rights, email{" "}
          <a href="mailto:jeremyw@dobeu.net">jeremyw@dobeu.net</a> with the subject
          &ldquo;Data Request — [your right]&rdquo;. We will respond within 30 days.
          California residents may also submit requests under the CCPA/CPRA using
          the same email address.
        </p>

        <h2>8. California residents (CCPA / CPRA)</h2>
        <p>
          If you are a California resident, you have additional rights under the
          California Consumer Privacy Act as amended by the California Privacy Rights
          Act:
        </p>
        <ul>
          <li>
            <strong>Right to know</strong> — categories and specific pieces of
            personal information we have collected about you in the past 12 months.
          </li>
          <li>
            <strong>Right to delete</strong> — deletion of personal information we
            collected from you, subject to certain exceptions.
          </li>
          <li>
            <strong>Right to correct</strong> — correction of inaccurate personal
            information.
          </li>
          <li>
            <strong>Right to opt out of sale or sharing</strong> — we do not sell or
            share personal information for cross-context behavioural advertising.
          </li>
          <li>
            <strong>Right to limit use of sensitive personal information</strong> —
            we do not collect sensitive personal information as defined by the CPRA
            beyond what is necessary for the services.
          </li>
          <li>
            <strong>Non-discrimination</strong> — we will not discriminate against
            you for exercising your CCPA/CPRA rights.
          </li>
        </ul>
        <p>
          To submit a CCPA/CPRA request, email{" "}
          <a href="mailto:jeremyw@dobeu.net">jeremyw@dobeu.net</a> with &ldquo;CCPA
          Request&rdquo; in the subject line.
        </p>

        <h2>9. Security</h2>
        <p>
          We implement industry-standard technical and organisational measures to
          protect your data, including TLS encryption in transit, httpOnly session
          cookies, Vercel Skew Protection, Content Security Policy headers, and
          access controls. However, no system is completely secure. We will notify
          affected users in accordance with applicable law in the event of a data
          breach.
        </p>

        <h2>10. Children&apos;s privacy</h2>
        <p>
          The Services are not directed to individuals under the age of 18. We do not
          knowingly collect personal data from minors. If you believe we have
          inadvertently collected such data, contact us immediately at{" "}
          <a href="mailto:jeremyw@dobeu.net">jeremyw@dobeu.net</a>.
        </p>

        <h2>11. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes will
          be communicated by email to registered users and via a notice on this page
          at least 14 days before taking effect.
        </p>

        <h2>12. Contact and supervisory authority</h2>
        <p>
          Dobeu Tech Solutions LLC &middot; New York, NY &middot;{" "}
          <a href="mailto:jeremyw@dobeu.net">jeremyw@dobeu.net</a>
        </p>
        <p>
          If you are in the EEA and believe we have not handled your data lawfully,
          you have the right to lodge a complaint with your local data protection
          authority.
        </p>
      </main>
      <SiteFooter />
    </LightboxProvider>
  );
}
