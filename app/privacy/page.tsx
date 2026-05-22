import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LightboxProvider } from "@/components/landing/LightboxProvider";

export const metadata: Metadata = {
  title: "Privacy",
  alternates: { canonical: "/privacy" }
};

export default function PrivacyPage() {
  return (
    <LightboxProvider>
      <SiteNav />
      <main id="main" className="container max-w-3xl py-16 prose dark:prose-invert">
        <h1>Privacy</h1>
        <p>
          <em>Last updated: May 21, 2026.</em>
        </p>
        <p>
          Dobeu Tech Solutions LLC (&ldquo;Dobeu&rdquo;, &ldquo;we&rdquo;) operates dobeu.net. This page describes what data
          we collect, why, and how to opt out.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Contact info you give us</strong> — email, name, company, message — when you submit
            a form or sign up.
          </li>
          <li>
            <strong>Usage data</strong> — pages visited, clicks, time on site, referrer, UTM
            parameters. Collected via PostHog, Mixpanel, and Google Analytics 4 only after you
            accept the cookie banner.
          </li>
          <li>
            <strong>Authentication data</strong> — Supabase session cookies for logged-in clients.
          </li>
          <li>
            <strong>Payment metadata</strong> — invoice ID and status. Card data is handled by Stripe
            and never touches our servers.
          </li>
        </ul>

        <h2>How we use it</h2>
        <p>
          To reply to your inquiry, deliver work, send invoices, and improve the site. We do not
          sell personal data. We do not run third-party advertising tags.
        </p>

        <h2>Third parties</h2>
        <p>
          We share data only with processors we depend on to run the business: Supabase (database +
          auth), Vercel (hosting), Resend + Customer.io (email), Stripe (payments), Apollo.io (CRM),
          PostHog/Mixpanel/Google Analytics (analytics).
        </p>

        <h2>Your rights</h2>
        <p>
          You can ask us at any time to export or delete your data. Email{" "}
          <a href="mailto:jeremyw@dobeu.net">jeremyw@dobeu.net</a> with the request and we&apos;ll
          confirm within 30 days. You can also decline cookies in the banner shown on first visit.
        </p>

        <h2>Contact</h2>
        <p>
          Dobeu Tech Solutions LLC · New York, NY ·{" "}
          <a href="mailto:jeremyw@dobeu.net">jeremyw@dobeu.net</a>
        </p>
      </main>
      <SiteFooter />
    </LightboxProvider>
  );
}
