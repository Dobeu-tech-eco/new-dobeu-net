import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LightboxProvider } from "@/components/landing/LightboxProvider";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How Dobeu Tech Solutions uses cookies and how to manage your preferences.",
  alternates: { canonical: "/cookies" },
  robots: { index: true, follow: true },
};

export default function CookiesPage() {
  return (
    <LightboxProvider>
      <SiteNav />
      <main id="main" className="container max-w-3xl py-16 prose dark:prose-invert">
        <h1>Cookie Policy</h1>
        <p>
          <em>Last updated: June 20, 2026.</em>
        </p>

        <p>
          Dobeu Tech Solutions LLC (&ldquo;Dobeu&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
          uses cookies and similar tracking technologies on dobeu.net. This policy
          explains what cookies we use, why, and how you can control them.
        </p>

        <h2>What are cookies?</h2>
        <p>
          Cookies are small text files stored on your device by your browser. They
          allow a website to recognise your device across visits and remember
          preferences or session state. Some cookies are set by us directly;
          others are set by third-party services we embed.
        </p>

        <h2>Cookie categories we use</h2>

        <h3>Strictly necessary</h3>
        <p>
          These cookies are required for the site to function and cannot be
          switched off. They do not store personally identifiable information.
        </p>
        <table>
          <thead>
            <tr>
              <th>Cookie</th>
              <th>Purpose</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>sb-*</code></td>
              <td>Supabase authentication session</td>
              <td>Session / 1 week</td>
            </tr>
            <tr>
              <td><code>__vdpl</code></td>
              <td>Vercel Skew Protection — links client assets to the correct server deployment</td>
              <td>Session</td>
            </tr>
            <tr>
              <td><code>dobeu_cookie_consent</code></td>
              <td>Remembers your cookie preference to avoid re-showing the banner</td>
              <td>1 year</td>
            </tr>
            <tr>
              <td><code>__stripe_mid</code>, <code>__stripe_sid</code></td>
              <td>Stripe fraud prevention for payment flows</td>
              <td>1 year / Session</td>
            </tr>
          </tbody>
        </table>

        <h3>Analytics (opt-in)</h3>
        <p>
          Set only after you accept the cookie banner. Used to understand how
          visitors use the site. All data is aggregated and anonymised before
          we review it.
        </p>
        <table>
          <thead>
            <tr>
              <th>Cookie / Key</th>
              <th>Service</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>ph_*</code></td>
              <td>PostHog — session recording and funnels</td>
              <td>1 year</td>
            </tr>
            <tr>
              <td><code>mp_*</code></td>
              <td>Mixpanel — event analytics</td>
              <td>1 year</td>
            </tr>
            <tr>
              <td><code>_ga</code>, <code>_ga_*</code></td>
              <td>Google Analytics 4 — traffic analytics</td>
              <td>2 years</td>
            </tr>
          </tbody>
        </table>

        <h3>Support &amp; chat (opt-in)</h3>
        <table>
          <thead>
            <tr>
              <th>Cookie / Key</th>
              <th>Service</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>intercom-*</code></td>
              <td>Intercom — live chat and messaging</td>
              <td>9 months</td>
            </tr>
          </tbody>
        </table>

        <h2>How to manage cookies</h2>
        <p>
          When you first visit dobeu.net, a consent banner lets you accept or
          decline analytics and support cookies. You can change your preference at
          any time by clicking <strong>&ldquo;Cookie preferences&rdquo;</strong> in
          the footer.
        </p>
        <p>
          You can also control cookies via your browser settings. Note that blocking
          strictly necessary cookies will prevent the client portal and payment
          flows from functioning.
        </p>
        <ul>
          <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noreferrer">Chrome</a></li>
          <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noreferrer">Firefox</a></li>
          <li><a href="https://support.apple.com/en-us/HT201265" target="_blank" rel="noreferrer">Safari</a></li>
          <li><a href="https://support.microsoft.com/en-us/windows/delete-and-manage-cookies-168dab11-0753-043d-7c16-ede5947fc64d" target="_blank" rel="noreferrer">Edge</a></li>
        </ul>

        <h2>Do Not Track</h2>
        <p>
          We respect the <code>DNT</code> browser signal. When DNT is enabled,
          analytics cookies are not loaded regardless of your banner selection.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          We may update this policy when we add or remove cookies. Material changes
          will be communicated via the cookie banner on next visit.
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
