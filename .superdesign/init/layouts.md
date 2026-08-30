# Shared layouts

Marketing pages compose `LightboxProvider` → `SiteNav` → `<main>` → `SiteFooter`. Root `app/layout.tsx` wraps everything with theme + analytics. ThemeToggle is mounted in SiteNav.

## RootLayout
- Path: `app/layout.tsx`
- Renders: App shell: Nunito variable, skip-link, ThemeProvider, AnalyticsProvider (CookieBanner), Toaster, JSON-LD graph. Applies to every route.

```tsx
import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { getSiteUrl, safeJsonLdStringify } from "@/lib/utils";
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
  );
}
```

## SiteNav
- Path: `components/landing/SiteNav.tsx`
- Renders: Sticky marketing nav: DobeuMark wordmark, availability pill, hash links, Universe dropdown, GitHub, ThemeToggle, Book-a-call lightbox CTA, mobile drawer.

```tsx
"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Menu, X, ChevronDown, GitBranch, ExternalLink, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DobeuMark } from "@/components/brand/DobeuMark";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { AVAILABILITY, SUB_BRANDS, FOUNDER } from "@/lib/jeremy-data";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_LINKS = [
  { href: "#work", label: "Work" },
  { href: "#how", label: "Process" },
  { href: "#about", label: "About" },
  { href: "#faq", label: "FAQ" },
];

const AVAILABILITY_STYLES = {
  open: {
    dot: "bg-green-400 shadow-[0_0_5px_1px_rgba(74,222,128,0.5)]",
    badge: "text-green-400 border-green-400/20 bg-green-400/6",
  },
  limited: {
    dot: "bg-amber-400 shadow-[0_0_5px_1px_rgba(251,191,36,0.5)]",
    badge: "text-amber-400 border-amber-400/20 bg-amber-400/6",
  },
  closed: {
    dot: "bg-muted-foreground",
    badge: "text-muted-foreground border-border bg-muted/50",
  },
} as const;

export function SiteNav() {
  const { open } = useLightbox();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const brandsRef = useRef<HTMLLIElement>(null);
  const avStyle = AVAILABILITY_STYLES[AVAILABILITY.status];

  // Detect scroll for elevated nav look
  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handle, { passive: true });
    return () => window.removeEventListener("scroll", handle);
  }, []);

  // Close brands dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (brandsRef.current && !brandsRef.current.contains(e.target as Node)) {
        setBrandsOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full">
      <div
        className={cn(
          "border-b transition-all duration-300",
          scrolled
            ? "border-border/60 bg-background/90 backdrop-blur-xl shadow-sm"
            : "border-transparent bg-background/60 backdrop-blur-md"
        )}
      >
        <nav
          aria-label="Primary"
          className="container flex h-[60px] items-center justify-between gap-4"
        >
          {/* ── Left: Logo + availability ── */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-2.5 flex-shrink-0 group"
              aria-label="Dobeu home"
            >
              <DobeuMark className="h-7 w-7" />
              <span className="font-display text-[1.1rem] tracking-tight lowercase leading-none hidden sm:inline select-none">
                <span className="font-extrabold text-[hsl(var(--brand-indigo-slate))] group-hover:text-primary transition-colors duration-200">
                  dobeu
                </span>
                <span className="font-medium text-muted-foreground">.net</span>
              </span>
            </Link>

            {/* Availability pill — restrained */}
            <span
              className={cn(
                "hidden lg:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-none",
                avStyle.badge
              )}
              aria-label={`Availability: ${AVAILABILITY.label}`}
            >
              <span
                className={cn("h-1.5 w-1.5 rounded-full animate-pulse flex-shrink-0", avStyle.dot)}
                aria-hidden="true"
              />
              {AVAILABILITY.label}
            </span>
          </div>

          {/* ── Center: Nav links ── */}
          <ul className="hidden md:flex items-center gap-0" role="list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-md px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
                >
                  {link.label}
                </Link>
              </li>
            ))}

            {/* Universe dropdown */}
            <li ref={brandsRef} className="relative">
              <button
                type="button"
                onClick={() => setBrandsOpen((v) => !v)}
                aria-expanded={brandsOpen}
                aria-haspopup="true"
                className="flex items-center gap-1 rounded-md px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                Universe
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    brandsOpen && "rotate-180"
                  )}
                  aria-hidden="true"
                />
              </button>

              {brandsOpen && (
                <div
                  role="menu"
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-60 rounded-xl border border-border bg-elevated shadow-lg overflow-hidden"
                >
                  <div className="px-4 py-2.5 border-b border-border/40">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                      The Dobeu Universe
                    </p>
                  </div>
                  {SUB_BRANDS.map((brand) => (
                    <Link
                      key={brand.name}
                      href={brand.href}
                      role="menuitem"
                      target={brand.href.startsWith("http") ? "_blank" : undefined}
                      rel={brand.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      onClick={() => setBrandsOpen(false)}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {brand.label}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{brand.description}</p>
                      </div>
                      <ExternalLink
                        className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0"
                        aria-hidden="true"
                      />
                    </Link>
                  ))}
                </div>
              )}
            </li>
          </ul>

          {/* ── Right: GitHub + toggle + CTA ── */}
          <div className="flex items-center gap-1.5">
            <Link
              href={FOUNDER.github}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Jeremy's GitHub"
            >
              <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
              <span>dobeutech</span>
            </Link>

            <ThemeToggle />

            <Button
              onClick={() => open("book")}
              size="sm"
              className="hidden sm:inline-flex bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-8 px-4 text-xs rounded-lg"
            >
              Book a call
              <ArrowRight className="ml-1.5 h-3 w-3" aria-hidden="true" />
            </Button>

            {/* Mobile toggle */}
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-foreground hover:bg-muted/60 transition-colors"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen
                ? <X className="h-5 w-5" aria-hidden="true" />
                : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </nav>

        {/* ── Mobile drawer ── */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border/40 bg-background/98 backdrop-blur-xl">
            {/* Availability */}
            <div className="px-5 py-3 border-b border-border/30">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                  avStyle.badge
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", avStyle.dot)} aria-hidden="true" />
                {AVAILABILITY.label}
              </span>
            </div>

            <nav aria-label="Mobile navigation">
              <ul className="flex flex-col px-5 py-3">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex items-center rounded-lg px-2 py-3 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}

                {/* Universe in mobile */}
                <li className="pt-3 mt-1 border-t border-border/30">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    The Dobeu Universe
                  </p>
                  {SUB_BRANDS.map((brand) => (
                    <Link
                      key={brand.name}
                      href={brand.href}
                      target={brand.href.startsWith("http") ? "_blank" : undefined}
                      rel={brand.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="flex items-center justify-between rounded-lg px-2 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      onClick={() => setMobileOpen(false)}
                    >
                      <span>{brand.label}</span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                    </Link>
                  ))}
                </li>

                <li className="pt-4 pb-3">
                  <Button
                    onClick={() => {
                      setMobileOpen(false);
                      open("book");
                    }}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                    size="lg"
                  >
                    Book a call
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
```

## SiteFooter
- Path: `components/landing/SiteFooter.tsx`
- Renders: Marketing footer: mark + tagline, Site/Account/Contact/Legal columns, copyright, cookie-preferences opener.

```tsx
"use client";

import Link from "next/link";
import { DobeuMark } from "@/components/brand/DobeuMark";

const FOOTER_LINKS = {
  Site: [
    { label: "Work", href: "/#work" },
    { label: "Process", href: "/#how" },
    { label: "About", href: "/#about" },
    { label: "FAQ", href: "/#faq" },
    { label: "Repos", href: "/repos" },
  ],
  Account: [
    { label: "Log in", href: "/login" },
    { label: "Client portal", href: "/portal" },
  ],
  Contact: [
    { label: "jeremyw@dobeu.net", href: "mailto:jeremyw@dobeu.net", external: true },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/jeremy-williams", external: true },
    { label: "Status", href: "https://status.dobeu.net", external: true },
  ],
  Legal: [
    { label: "Terms", href: "/terms" },
    { label: "Privacy", href: "/privacy" },
    { label: "Cookies", href: "/cookies" },
    { label: "SMS Opt-In", href: "/optin/sms" },
    { label: "Marketing Opt-Out", href: "/marketing-opt-out" },
  ],
};

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/30 bg-background">
      <div className="container max-w-6xl py-14 md:py-16">

        {/* Top row: brand identity + nav columns */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-10 md:gap-16 mb-12">
          {/* Brand identity */}
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5 mb-4">
              <DobeuMark className="h-8 w-8 shrink-0" />
              <div>
                <p className="font-display text-base font-extrabold text-[hsl(var(--brand-indigo-slate))] leading-tight lowercase">
                  dobeu.net
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ship the agent. Ship the app. Ship the brand. One operator, modern stack.
            </p>
            <p className="mt-2 text-xs text-muted-foreground/50">
              dobeu.net &middot; dobeu.cloud &middot; dobeutech.com
            </p>
          </div>

          {/* Nav grid */}
          <nav
            className="grid grid-cols-2 sm:grid-cols-4 gap-8"
            aria-label="Footer navigation"
          >
            {Object.entries(FOOTER_LINKS).map(([group, links]) => (
              <div key={group}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  {group}
                </p>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link.label}>
                      {"external" in link && link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-border/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-muted-foreground/50">
          <p>
            &copy; {year} Dobeu Tech Solutions LLC. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-muted-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-muted-foreground transition-colors">Terms</Link>
            <button
              type="button"
              className="hover:text-muted-foreground transition-colors"
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  (window as Window & { openCookiePreferences?: () => void }).openCookiePreferences
                ) {
                  (window as Window & { openCookiePreferences?: () => void }).openCookiePreferences!();
                }
              }}
            >
              Cookie preferences
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

## LegalLayout
- Path: `components/landing/LegalLayout.tsx`
- Renders: Legal page wrapper: LightboxProvider + SiteNav + sticky legal sidebar + prose article + SiteFooter. Props: title, lastUpdated, children.

```tsx
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LightboxProvider } from "@/components/landing/LightboxProvider";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface LegalLayoutProps {
  /** Page title shown at the top of the content area */
  title: string;
  /** ISO date string for "Last updated" sub-line */
  lastUpdated: string;
  children: React.ReactNode;
}

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/optin/sms", label: "SMS Opt-In" },
];

export function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  return (
    <LightboxProvider>
      <SiteNav />
      <main id="main" className="container max-w-5xl py-14 md:py-20">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to home
        </Link>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          {/* Sticky sidebar nav */}
          <aside className="lg:w-52 lg:shrink-0">
            <div className="lg:sticky lg:top-20 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-2">
                Legal
              </p>
              {LEGAL_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={
                    "block rounded-lg px-2 py-1.5 text-sm transition-colors " +
                    (href === `/${title.toLowerCase().replace(/\s+/g, "-")}`
                      ? "font-semibold text-foreground bg-muted"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60")
                  }
                >
                  {label}
                </Link>
              ))}
            </div>
          </aside>

          {/* Content */}
          <article className="flex-1 min-w-0">
            <header className="mb-8 pb-6 border-b border-border">
              <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-balance">
                {title}
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                Last updated:{" "}
                <time dateTime={lastUpdated}>
                  {new Date(lastUpdated).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              </p>
            </header>

            {/* Prose content from individual page */}
            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-headings:font-display prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none">
              {children}
            </div>
          </article>
        </div>
      </main>
      <SiteFooter />
    </LightboxProvider>
  );
}
```

## DobeuMark
- Path: `components/brand/DobeuMark.tsx`
- Renders: Inlined official mark (three masked circles). Single prop: className.

```tsx
import * as React from "react";

/**
 * Official Dobeu mark — three masked circles per Design System v2 (canonical
 * `uploads/dobeu-symbol.svg` from the brand kit). Flat fills, no gradient.
 *
 *   - Left lobe   #6B5CE7 (Indigo Vivid)
 *   - Right lobe  #4A3FA8 (Indigo Deep)
 *   - Lens        #F4A261 (Amber Sunset)
 *
 * Inlined SVG (no <img>/network round-trip), zero JS, crisp at any size.
 * Keeps the `{ className }` API so all 6 call sites continue to work unchanged.
 */
export function DobeuMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 500"
      role="img"
      aria-label="Dobeu mark"
      className={className}
    >
      <defs>
        <mask id="dobeu-mark-cutA" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
          <rect width="500" height="500" fill="#fff" />
          <circle cx="315" cy="235" r="78" fill="#000" />
        </mask>
        <mask id="dobeu-mark-cutC1" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
          <rect width="500" height="500" fill="#fff" />
          <circle cx="175" cy="248" r="122" fill="#000" />
        </mask>
        <mask
          id="dobeu-mark-cutC1A"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="500"
          height="500"
        >
          <rect width="500" height="500" fill="#fff" />
          <circle cx="175" cy="248" r="122" fill="#000" />
          <circle cx="315" cy="235" r="78" fill="#000" />
        </mask>
      </defs>
      <circle cx="322" cy="258" r="105" fill="#4A3FA8" mask="url(#dobeu-mark-cutC1A)" />
      <circle cx="175" cy="248" r="122" fill="#6B5CE7" mask="url(#dobeu-mark-cutA)" />
      <circle cx="315" cy="235" r="78" fill="#F4A261" mask="url(#dobeu-mark-cutC1)" />
    </svg>
  );
}
```

## ThemeToggle
- Path: `components/theme-toggle.tsx`
- Renders: Used in SiteNav (and portal/admin/company shells). Light / Dark / System via next-themes + DropdownMenu.

```tsx
"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Theme toggle — Light / Dark / System.
 * Renders an icon button that opens a small menu.
 */
export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          aria-current={mounted && theme === "light"}
        >
          <Sun className="mr-2 h-4 w-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          aria-current={mounted && theme === "dark"}
        >
          <Moon className="mr-2 h-4 w-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          aria-current={mounted && theme === "system"}
        >
          <Monitor className="mr-2 h-4 w-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```
