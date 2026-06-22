import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LightboxProvider } from "@/components/landing/LightboxProvider";

export const metadata: Metadata = {
  title: "Marketing Opt-Out",
  description: "Opt out of marketing communications from Dobeu Tech Solutions LLC.",
  alternates: { canonical: "/marketing-opt-out" },
  robots: { index: true, follow: true },
};

export default function MarketingOptOutPage() {
  return (
    <LightboxProvider>
      <SiteNav />
      <main id="main" className="container max-w-3xl py-16 prose dark:prose-invert">
        <h1>Marketing Opt-Out</h1>
        <p>
          <em>Last updated: June 20, 2026.</em>
        </p>
        <p>
          You have the right to opt out of marketing communications from Dobeu Tech
          Solutions LLC at any time, for free, without affecting your access to the
          client portal or delivery of contracted services.
        </p>

        <h2>Email marketing</h2>
        <p>
          To stop receiving marketing emails (newsletters, follow-up sequences,
          promotional announcements):
        </p>
        <ul>
          <li>
            Click the <strong>Unsubscribe</strong> link at the bottom of any
            marketing email we have sent you. This removes you from all Customer.io
            sequences within 24 hours.
          </li>
          <li>
            Email <a href="mailto:jeremyw@dobeu.net">jeremyw@dobeu.net</a> with
            &ldquo;Email opt-out&rdquo; in the subject line. We will process your
            request within 24 hours.
          </li>
        </ul>
        <p>
          Note: transactional emails (invoice receipts, booking confirmations,
          project status updates, and password reset emails) are not marketing
          communications and cannot be unsubscribed from while you are an active
          client. They will stop automatically when your engagement ends and your
          account is closed.
        </p>

        <h2>SMS marketing</h2>
        <p>
          To opt out of SMS messages, see our{" "}
          <a href="/optin/sms">SMS Opt-In Policy</a>. In short: reply{" "}
          <strong>STOP</strong> to any message from us.
        </p>

        <h2>Analytics and tracking</h2>
        <p>
          To opt out of analytics cookies (PostHog, Mixpanel, Google Analytics,
          Datadog) and support chat (Intercom):
        </p>
        <ul>
          <li>
            Click <strong>&ldquo;Cookie preferences&rdquo;</strong> in the footer of
            any page on dobeu.net and deselect the categories you wish to disable.
          </li>
          <li>
            Enable the <strong>Do Not Track</strong> setting in your browser — we
            honour this signal automatically and will not load any analytics scripts.
          </li>
        </ul>

        <h2>Opt out of data sale or sharing (CCPA)</h2>
        <p>
          We do not sell or share personal information for cross-context behavioural
          advertising. If you are a California resident and wish to exercise your
          CCPA/CPRA rights, see our <a href="/privacy">Privacy Policy</a> or email{" "}
          <a href="mailto:jeremyw@dobeu.net">jeremyw@dobeu.net</a>.
        </p>

        <h2>Contact</h2>
        <p>
          For any opt-out request not covered above, contact us at:{" "}
          <a href="mailto:jeremyw@dobeu.net">jeremyw@dobeu.net</a>
        </p>
        <p>
          Dobeu Tech Solutions LLC &middot; New York, NY
        </p>
      </main>
      <SiteFooter />
    </LightboxProvider>
  );
}
