import type { Metadata, Viewport } from "next";
import { Source_Sans_3, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { RouteLight } from "@/components/motion/RouteLight";
import { ExperienceProvider } from "@/components/landing/ExperienceProvider";
import { DeferredToaster } from "@/components/landing/DeferredToaster";
import {
  FOUNDER,
  NAP,
  ORGANIZATION_SAME_AS,
  PERSON_SAME_AS,
  SITE_IDENTITY,
} from "@/lib/jeremy-data";
import { getSiteUrl, safeJsonLdStringify } from "@/lib/utils";
import "./globals.css";

/**
 * Dobeu site typography — Source Sans 3 (weights 400/500/600/700/800).
 * Used for both `font-sans` and `font-display` in tailwind.config.ts.
 */
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  // optional: if the font misses the first paint, keep the fallback so a late
  // swap cannot become LCP after homepage JS (mobile LH was 3.4s / 0.89).
  display: "optional",
  variable: "--font-source-sans",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "optional",
});

const SITE_URL = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Dobeu Tech Solutions — Software shaped around your operation",
    template: "%s · Dobeu Tech Solutions",
  },
  description:
    "Custom operational software, integrations, and automation shaped around how your business works. Work directly with Jeremy Williams, from discovery to handover.",
  authors: [{ name: "Jeremy Williams", url: SITE_URL }],
  creator: "Dobeu Tech Solutions",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Dobeu Tech Solutions",
    title: "Dobeu Tech Solutions — Software shaped around your operation",
    description:
      "Custom operational software, integrations, and automation. Work directly with the person building your system.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dobeu Tech Solutions",
    description: "Custom software shaped around your operation.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  // Favicon, icon, and apple-icon resolve via Next.js metadata file convention
  // from app/favicon.ico, app/icon.svg, app/apple-icon.png — no `icons:` block needed.
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1A2E" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-brand="net"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${sourceSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <ThemeProvider defaultTheme="dark">
          <ExperienceProvider>
            <RouteLight />
            <AnalyticsProvider>{children}</AnalyticsProvider>
            <DeferredToaster />
          </ExperienceProvider>
        </ThemeProvider>
        {/* JSON-LD structured data — WebSite + Person + Organization graph
            WebSite: provides canonical name + URL signal.
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
                    "Custom operational software, integrations, and automation shaped around how your business works.",
                  publisher: { "@id": `${SITE_URL}/#organization` },
                  inLanguage: "en-US",
                },
                {
                  "@type": "Person",
                  "@id": `${SITE_URL}/#person`,
                  name: FOUNDER.name,
                  url: SITE_URL,
                  jobTitle: FOUNDER.title,
                  worksFor: { "@id": `${SITE_URL}/#organization` },
                  sameAs: [...PERSON_SAME_AS],
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
                    addressCountry: "US",
                  },
                  areaServed: NAP.areaServed,
                  logo: {
                    "@type": "ImageObject",
                    url: `${SITE_URL}/brand/dobeu-horizontal.png`,
                    width: 400,
                    height: 80,
                  },
                  founder: { "@id": `${SITE_URL}/#person` },
                  sameAs: [...ORGANIZATION_SAME_AS],
                },
              ],
            }),
          }}
        />
      </body>
    </html>
  );
}
