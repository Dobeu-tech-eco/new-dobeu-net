"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { initAnalytics, pageView } from "@/lib/analytics";
import { initDatadog } from "@/lib/datadog";
import { initIntercom } from "@/lib/intercom";

const CONSENT_KEY = "dobeu-analytics-consent";

/**
 * AnalyticsProvider — gates PostHog/Mixpanel on user consent and
 * loads GA4 + GTM via <Script>. Fires pageview on every route change.
 *
 * NOTE: We read query string from window.location directly (not useSearchParams)
 * to avoid forcing the whole app into a Suspense boundary in Next 15.5+ which
 * has known streaming issues in dev. See:
 * https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [consent, setConsent] = React.useState<boolean | null>(null);

  // Hydrate consent from localStorage on mount
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (stored === "granted") setConsent(true);
    else if (stored === "denied") setConsent(false);
  }, []);

  // Init analytics once consent is granted (PostHog/Mixpanel + Datadog RUM+Logs)
  React.useEffect(() => {
    if (consent === true) {
      initAnalytics(true);
      initDatadog();
      initIntercom();
    }
  }, [consent]);

  // Fire pageview on navigation
  React.useEffect(() => {
    if (consent !== true) return;
    const search = typeof window !== "undefined" ? window.location.search : "";
    const url = pathname + search;
    pageView(url);
  }, [pathname, consent]);

  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const ga4Id = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;

  return (
    <>
      {/* GTM — always loads but tags are consent-gated inside GTM */}
      {gtmId && (
        <Script id="gtm-loader" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      )}

      {/* GA4 direct (in case GTM not configured) */}
      {ga4Id && !gtmId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ga4Id}', { anonymize_ip: true });`}
          </Script>
        </>
      )}

      {children}

      {/* Cookie consent banner — only shown if consent is unset */}
      {consent === null && (
        <div
          role="dialog"
          aria-labelledby="consent-title"
          aria-describedby="consent-desc"
          className="fixed bottom-4 left-4 right-4 md:left-auto md:max-w-md z-50 glass rounded-xl p-4 shadow-glow animate-fade-up"
        >
          <h3 id="consent-title" className="font-semibold mb-1 text-sm">
            Cookies and analytics
          </h3>
          <p id="consent-desc" className="text-xs text-muted-foreground mb-3">
            We use PostHog, Mixpanel, and Google Analytics to understand how
            visitors use this site so we can improve it. Nothing is sold; you
            can opt out anytime.
          </p>
          <div className="flex gap-2">
            <button
              className="text-xs rounded-md bg-primary text-primary-foreground px-3 py-1.5 font-medium hover:opacity-90 transition"
              onClick={() => {
                window.localStorage.setItem(CONSENT_KEY, "granted");
                setConsent(true);
              }}
            >
              Accept
            </button>
            <button
              className="text-xs rounded-md border border-border px-3 py-1.5 font-medium hover:bg-muted transition"
              onClick={() => {
                window.localStorage.setItem(CONSENT_KEY, "denied");
                setConsent(false);
              }}
            >
              Decline
            </button>
          </div>
        </div>
      )}
    </>
  );
}
