import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'

import './globals.css'
import { Geist, Geist_Mono, Geist as V0_Font_Geist, Geist_Mono as V0_Font_Geist_Mono, Source_Serif_4 as V0_Font_Source_Serif_4 } from 'next/font/google'

// Initialize fonts
const _geist = V0_Font_Geist({ subsets: ['latin'], weight: ["100","200","300","400","500","600","700","800","900"] })
const _geistMono = V0_Font_Geist_Mono({ subsets: ['latin'], weight: ["100","200","300","400","500","600","700","800","900"] })
const _sourceSerif_4 = V0_Font_Source_Serif_4({ subsets: ['latin'], weight: ["200","300","400","500","600","700","800","900"] })

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
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
            __html: JSON.stringify({
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
                  name: "Jeremy Williams",
                  url: SITE_URL,
                  jobTitle: "Founder & Principal Engineer",
                  worksFor: { "@id": `${SITE_URL}/#organization` },
                  sameAs: [
                    "https://www.linkedin.com/in/jeremy-williams"
                  ]
                },
                {
                  "@type": "Organization",
                  "@id": `${SITE_URL}/#organization`,
                  name: "Dobeu Tech Solutions LLC",
                  url: SITE_URL,
                  logo: {
                    "@type": "ImageObject",
                    url: `${SITE_URL}/brand/dobeu-horizontal.png`,
                    width: 400,
                    height: 80
                  },
                  founder: { "@id": `${SITE_URL}/#person` },
                  sameAs: [
                    "https://www.linkedin.com/in/jeremy-williams"
                  ]
                }
              ]
            })
          }}
        />
      </body>
    </html>
  )
}
