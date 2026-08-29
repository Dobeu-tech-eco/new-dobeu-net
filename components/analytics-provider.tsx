"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { initAnalytics, pageView, setAnalyticsConsent } from "@/lib/analytics";
import { setDatadogConsent } from "@/lib/datadog";
import { IntercomSecureBoot } from "@/components/intercom/IntercomSecureBoot";
import { CookieBanner } from "@/components/CookieBanner";
import { useCookieConsent } from "@/hooks/use-cookie-consent";

/**
 * AnalyticsProvider — gates all third-party scripts on granular cookie consent.
 *
 * Analytics (PostHog, Mixpanel, GA4, GTM, Datadog) → consent.analytics
 * Support / chat (Intercom)                         → consent.support
 * Marketing sequences (Customer.io)                 → consent.marketing
 *
 * NOTE: We read query string from window.location directly (not useSearchParams)
 * to avoid forcing the whole app into a Suspense boundary in Next 15.5+.
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { consent } = useCookieConsent();

  // Init / tear-down analytics when consent changes.
  React.useEffect(() => {
    setAnalyticsConsent(consent.analytics);
    // Datadog handles both grant and withdrawal (withdrawal stops collection
    // and clears the session cookie), so it is called unconditionally.
    void setDatadogConsent(consent.analytics);
    if (!consent.analytics) return;
    initAnalytics(true);
  }, [consent.analytics]);

  // Fire pageview on navigation (analytics only).
  React.useEffect(() => {
    if (!consent.analytics) return;
    const search = typeof window !== "undefined" ? window.location.search : "";
    pageView(pathname + search);
  }, [pathname, consent.analytics]);

  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const ga4Id = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;

  return (
    <>
      {/* GTM — analytics consent required */}
      {consent.analytics && gtmId && (
        <Script id="gtm-loader" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      )}

      {/* GA4 direct (when GTM not configured) — analytics consent required */}
      {consent.analytics && ga4Id && !gtmId && (
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

      {/* Intercom — support consent required */}
      <IntercomSecureBoot enabled={consent.support} />

      {/* Vercel observability — analytics consent required */}
      {consent.analytics && (
        <>
          <VercelAnalytics />
          <SpeedInsights />
        </>
      )}

      {/* Cookie consent banner + preferences dialog */}
      <CookieBanner />
    </>
  );
}
