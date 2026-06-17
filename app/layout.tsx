import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { getSiteUrl } from "@/lib/utils";
import "./globals.css";

/**
 * Dobeu Design System v2 — Nunito only (weights 400/500/600/700/800).
 * Used for both `font-sans` and `font-display` in tailwind.config.ts.
 */
const nunito = Nunito({
  subsets: ["latin"],
  display: "swap",
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
  keywords: [
    "AI agent development",
    "Claude Composio",
    "Next.js Supabase",
    "design systems",
    "growth engineering",
    "Dobeu Tech Solutions",
    "Jeremy Williams"
  ],
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
    { media: "(prefers-color-scheme: dark)", color: "#1A1A2E" }
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
        {/* JSON-LD Organization schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Dobeu Tech Solutions LLC",
              url: SITE_URL,
              logo: `${SITE_URL}/brand/dobeu-horizontal.png`,
              founder: { "@type": "Person", name: "Jeremy Williams" },
              sameAs: ["https://www.linkedin.com/in/jeremy-williams"]
            })
          }}
        />
      </body>
    </html>
  );
}
