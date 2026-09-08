import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { FOUNDER, NAP, ORGANIZATION_SAME_AS, PERSON_SAME_AS, SITE_IDENTITY } from "@/lib/jeremy-data";
import { getSiteUrl, safeJsonLdStringify } from "@/lib/utils";
import "./globals.css";

/**
 * Dobeu Design System v2 — Nunito only (weights 400/500/600/700/800).
 * Used for both `font-sans` and `font-display` in tailwind.config.ts.
 */
const nunito = Nunito({
  subsets: ["latin"],
  // optional: if Nunito misses the first paint, keep the fallback so a late
  // swap cannot become LCP after homepage JS (mobile LH was 3.4s / 0.89).
  display: "optional",
  variable: "--font-nunito",
  weight: ["400", "500", "600", "700", "800"]
});

const SITE_URL = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Dobeu Tech Solutions — Ship the agent. Ship the app. Ship the brand.",
    template: "%s · Dobeu Tech Solutions"
  },
  description:
    "One operator. Modern stack. Production-grade AI agents, full-stack web apps, brand systems, and growth engineering for founders who need it shipped, not pitched.",
  authors: [{ name: "Jeremy Williams", url: SITE_URL }],
  creator: "Dobeu Tech Solutions",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Dobeu Tech Solutions",
    title: "Dobeu Tech Solutions — Ship the agent. Ship the app. Ship the brand.",
    description:
      "Production-grade AI agents, full-stack web apps, brand systems, and growth engineering. One operator. Modern stack.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Dobeu Tech Solutions",
    description: "Ship the agent. Ship the app. Ship the brand."
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" }
  }
  // Favicon, icon, and apple-icon resolve via Next.js metadata file convention
  // from app/favicon.ico, app/icon.svg, app/apple-icon.png — no `icons:` block needed.
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#111120" }
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-brand="net"
      suppressHydrationWarning
      className={nunito.variable}
    >
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <a href="#main" className="skip-link">Skip to main content</a>
        <ThemeProvider>
          <AnalyticsProvider>{children}</AnalyticsProvider>
          <Toaster position="bottom-right" theme="system" richColors closeButton />
        </ThemeProvider>
        {/* JSON-LD structured data — WebSite + Person + Organization graph
            WebSite: enables Google Sitelinks Searchbox; provides canonical name + URL signal.
            Person:  founder knowledge-panel signal; links personal identity to the org.
            Organization: brand identity, logo, and sameAs backlinks. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLdStringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": `${SITE_URL}/#website`,
                  url: SITE_URL,
                  name: "Dobeu Tech Solutions",
                  description:
                    "Production-grade AI agents, full-stack web apps, brand systems, and growth engineering.",
                  publisher: { "@id": `${SITE_URL}/#organization` },
                  potentialAction: {
                    "@type": "SearchAction",
                    target: {
                      "@type": "EntryPoint",
                      urlTemplate: `${SITE_URL}/?s={search_term_string}`
                    },
                    "query-input": "required name=search_term_string"
                  },
                  inLanguage: "en-US"
                },
                {
                  "@type": "Person",
                  "@id": `${SITE_URL}/#person`,
                  name: FOUNDER.name,
                  url: SITE_URL,
                  jobTitle: FOUNDER.title,
                  worksFor: { "@id": `${SITE_URL}/#organization` },
                  sameAs: [...PERSON_SAME_AS]
                },
                {
                  "@type": "Organization",
                  "@id": `${SITE_URL}/#organization`,
                  name: SITE_IDENTITY.legalName,
                  url: SITE_URL,
                  email: NAP.email,
                  address: {
                    "@type": "PostalAddress",
                    addressLocality: NAP.locality,
                    addressRegion: NAP.region,
                    addressCountry: "US"
                  },
                  areaServed: NAP.areaServed,
                  logo: {
                    "@type": "ImageObject",
                    url: `${SITE_URL}/brand/dobeu-horizontal.png`,
                    width: 400,
                    height: 80
                  },
                  founder: { "@id": `${SITE_URL}/#person` },
                  sameAs: [...ORGANIZATION_SAME_AS]
                }
              ]
            })
          }}
        />
      </body>
    </html>
  );
}
