import type { Metadata, Viewport } from "next";
import { Nunito, Quicksand } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/theme-provider";
import { AnalyticsProvider } from "@/components/analytics-provider";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-nunito",
  weight: ["300", "400", "600", "700", "800", "900"]
});

const quicksand = Quicksand({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-quicksand",
  weight: ["400", "500", "600", "700"]
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dobeu.net";

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
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1A2E" }
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5
};

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${nunito.variable} ${quicksand.variable}`}>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        {/* GTM noscript fallback — required by GTM install snippet so non-JS
            visitors and crawlers still hit the container. The async <script>
            loader lives in components/analytics-provider.tsx. */}
        {GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
            />
          </noscript>
        )}
        <a href="#main" className="skip-link">Skip to main content</a>
        <ThemeProvider>
          <AnalyticsProvider>{children}</AnalyticsProvider>
          <VercelAnalytics />
          <SpeedInsights />
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
              logo: `${SITE_URL}/logo.svg`,
              founder: { "@type": "Person", name: "Jeremy Williams" },
              sameAs: ["https://www.linkedin.com/in/jeremy-williams"]
            })
          }}
        />
      </body>
    </html>
  );
}
