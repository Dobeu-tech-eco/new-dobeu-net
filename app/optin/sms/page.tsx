import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LightboxProvider } from "@/components/landing/LightboxProvider";

export const metadata: Metadata = {
  title: "SMS Opt-In Policy",
  description: "How Dobeu Tech Solutions uses SMS messaging and how to opt in or out.",
  alternates: { canonical: "/optin/sms" },
  robots: { index: true, follow: true },
};

export default function SmsOptInPage() {
  return (
    <LightboxProvider>
      <SiteNav />
      <main id="main" className="container max-w-3xl py-16 prose dark:prose-invert">
        <h1>SMS Opt-In Policy</h1>
        <p>
          <em>Last updated: June 20, 2026.</em>
        </p>

        <p>
          Dobeu Tech Solutions LLC (&ldquo;Dobeu&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
          may send transactional and service-related SMS messages to clients and
          contacts who have explicitly opted in. This page describes how we use SMS,
          how to opt in, and how to opt out at any time.
        </p>

        <h2>Who sends these messages?</h2>
        <p>
          SMS messages are sent by Dobeu Tech Solutions LLC, New York, NY. We do not
          use shared short codes or aggregate messaging platforms. Messages originate
          from a dedicated number associated with our account.
        </p>

        <h2>What types of messages we send</h2>
        <ul>
          <li>
            <strong>Transactional</strong> — project status updates, invoice
            notifications, booking confirmations, and delivery alerts.
          </li>
          <li>
            <strong>Service alerts</strong> — important notices about your client
            portal, scheduled maintenance, or security events.
          </li>
          <li>
            <strong>Appointment reminders</strong> — reminders for booked calls or
            discovery sessions you have scheduled.
          </li>
        </ul>
        <p>
          We do not send promotional marketing SMS without a separate, explicit opt-in
          for that category.
        </p>

        <h2>How to opt in</h2>
        <p>
          You opt in to SMS communications by:
        </p>
        <ul>
          <li>
            Checking the SMS opt-in box on a booking or lead-capture form on this
            site; or
          </li>
          <li>
            Texting <strong>START</strong> to the number provided in your welcome
            email; or
          </li>
          <li>
            Providing your mobile number and verbal or written consent during an
            onboarding call.
          </li>
        </ul>
        <p>
          By opting in you confirm you are the account holder or have authority to
          receive messages at that number and that you are 18 years of age or older.
        </p>

        <h2>Message frequency</h2>
        <p>
          Message frequency varies based on project activity. Most active clients
          receive 2&ndash;8 messages per month. You will never receive unsolicited
          bulk messages.
        </p>

        <h2>Message and data rates</h2>
        <p>
          Standard message and data rates may apply based on your mobile carrier
          plan. Dobeu Tech Solutions does not charge a separate fee for SMS messages.
        </p>

        <h2>How to opt out</h2>
        <p>
          You may opt out at any time by replying <strong>STOP</strong> to any
          message we send. You will receive a single confirmation message and no
          further SMS communications. To re-subscribe, reply <strong>START</strong>.
        </p>
        <p>
          You can also opt out by emailing{" "}
          <a href="mailto:jeremyw@dobeu.net">jeremyw@dobeu.net</a> with &ldquo;SMS
          opt-out&rdquo; in the subject line. We will process your request within
          24 hours.
        </p>

        <h2>Help</h2>
        <p>
          Reply <strong>HELP</strong> to any message for a link to this page.
          For additional support, email{" "}
          <a href="mailto:jeremyw@dobeu.net">jeremyw@dobeu.net</a>.
        </p>

        <h2>Data handling</h2>
        <p>
          Your mobile number is stored in our CRM (Apollo.io) and messaging
          platform. We do not sell or share your number with third parties for
          marketing purposes. See our{" "}
          <a href="/privacy">Privacy Policy</a> for full data handling details.
        </p>

        <h2>Compliance</h2>
        <p>
          Our SMS program complies with the Telephone Consumer Protection Act
          (TCPA), the CAN-SPAM Act, CTIA Messaging Principles, and applicable
          carrier codes of conduct.
        </p>

        <h2>Contact</h2>
        <p>
          Dobeu Tech Solutions LLC &middot; New York, NY &middot;{" "}
          <a href="mailto:jeremyw@dobeu.net">jeremyw@dobeu.net</a>
        </p>
      </main>
      <SiteFooter />
    </LightboxProvider>
  );
}
