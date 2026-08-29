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
