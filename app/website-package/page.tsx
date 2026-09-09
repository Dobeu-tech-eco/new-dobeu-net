import type { Metadata } from "next";
import { Check, X } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { NAP } from "@/lib/jeremy-data";
import { WebsitePackageCta } from "./WebsitePackageCta";

// Reached by direct link only (referral, paid traffic, local outreach) —
// intentionally not in SiteNav or linked from the homepage, and intentionally
// not indexed. Market research across 12 operators publishing fixed-tier
// pricing found none co-list a cheap productized tier next to expensive
// custom work on the same site; publishing "$2,995" beside the main site's
// "$5k-$30k typical engagement" would anchor prospects down and blur the
// two offers in search results. Keeping this out of the index avoids that
// collision while still letting a direct link (e.g. a paid ad or a referral)
// land here and convert. See the report for the full call.
export const metadata: Metadata = {
  title: "Website Package — $2,995 Flat",
  description:
    "A production 5-page website, built on Next.js and Vercel, delivered in 3 weeks for a flat $2,995. Fixed scope, one structured intake round, capped revisions.",
  alternates: { canonical: "/website-package" },
  robots: { index: false, follow: false },
};

const INCLUDED = [
  "5 pages: Home, About, Services, Contact, and one more of your choice",
  "One structured intake round — a single form + a 30-minute call to lock scope, content, and brand direction",
  "Built on Next.js and deployed on Vercel — real production code you own outright, not a page-builder template",
  "Mobile-responsive, fast-loading, and built to a baseline SEO checklist (metadata, sitemap, semantic markup)",
  "One structured revision round after the first draft (documented change list, not open-ended back-and-forth)",
  "Contact form wired to your email",
  "Full source code and hosting handed over at delivery — no lock-in",
  "3-week delivery from the intake call",
] as const;

const EXCLUDED = [
  "E-commerce, booking systems, user accounts, or any custom backend/database work",
  "Content writing or copywriting — you provide the words, or we scope that separately",
  "Original logo or brand identity design",
  "Additional pages beyond the 5 included (available as a flat per-page add-on — ask on the call)",
  "Multiple revision rounds beyond the one included round",
  "Ongoing maintenance, hosting management, or content updates after handoff",
  "Rush delivery under 3 weeks",
] as const;

const FAQS = [
  {
    q: "Why is this fixed-price when the rest of the site quotes $5k–$30k?",
    a: "That range is for custom software and automation work scoped after a discovery call — every project is different, so the price is too. This is different: it's a pre-defined, capped scope (5 pages, one intake round, one revision round), so it can be priced up front instead of estimated.",
  },
  {
    q: "What makes this worth more than a $1,500–$2,000 website builder package?",
    a: "Those packages are typically built on page-builder templates. This is hand-built on the same production stack (Next.js + Vercel) used for the custom engagements on this site — real code, proper performance and SEO fundamentals, and full ownership transfer at delivery, not a locked-in platform.",
  },
  {
    q: "What happens if my project needs more than 5 pages or custom functionality?",
    a: "Say so on the intake call. Extra pages are a flat add-on; anything that needs a database, logins, payments, or custom backend logic is out of scope for this package and gets its own quote from the standard engagement process instead.",
  },
  {
    q: "What if I need changes after the one included revision round?",
    a: "Additional revision rounds or post-launch changes are billed separately at an hourly rate, quoted before any work starts.",
  },
] as const;

export default function WebsitePackagePage() {
  return (
    <MarketingShell>
      <header className="container max-w-6xl pt-16 pb-4 md:pt-20 md:pb-6">
        <Badge tone="amber" className="mb-4">
          Fixed scope
        </Badge>
        <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] text-balance">
          A production website. Flat $2,995.
        </h1>
        <p className="mt-4 max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed">
          5 pages, one structured intake round, one revision round, live in 3
          weeks. Built on the same production stack — Next.js, deployed on
          Vercel — as every other project on this site. No page-builder
          template, no lock-in: you own the code at delivery.
        </p>
        <div className="mt-8">
          <WebsitePackageCta location="website_package_hero" />
        </div>
      </header>

      <section className="container max-w-6xl py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="rounded-2xl border-border/40 bg-card/50 p-6 md:p-8">
            <h2 className="font-display text-xl font-bold tracking-tight mb-4">
              What&apos;s included
            </h2>
            <ul className="space-y-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-relaxed">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="rounded-2xl border-border/40 bg-card/50 p-6 md:p-8">
            <h2 className="font-display text-xl font-bold tracking-tight mb-4">
              What&apos;s not included
            </h2>
            <ul className="space-y-3">
              {EXCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-relaxed">
                  <X
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Need any of these? Say so on the intake call — most become a
              flat add-on or a short scope conversation, not a blocker.
            </p>
          </Card>
        </div>

        <div className="mt-10 rounded-2xl border border-border/40 bg-card/50 p-6 md:p-8">
          <h2 className="font-display text-xl font-bold tracking-tight mb-2">
            How it works
          </h2>
          <ol className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
            <li>
              <p className="font-semibold text-foreground">1. Intake</p>
              <p className="mt-1 text-muted-foreground leading-relaxed">
                One structured form plus a 30-minute call to lock pages,
                content, and direction.
              </p>
            </li>
            <li>
              <p className="font-semibold text-foreground">2. Build</p>
              <p className="mt-1 text-muted-foreground leading-relaxed">
                Built on Next.js and deployed to Vercel. First draft delivered
                for review.
              </p>
            </li>
            <li>
              <p className="font-semibold text-foreground">3. Revise &amp; hand off</p>
              <p className="mt-1 text-muted-foreground leading-relaxed">
                One documented revision round, then full source and hosting
                access handed over. Live in 3 weeks.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="container max-w-6xl pb-16 md:pb-24">
        <h2 className="font-display text-xl font-bold tracking-tight mb-4">
          Questions
        </h2>
        <Accordion type="single" collapsible className="w-full max-w-3xl">
          {FAQS.map((f, i) => (
            <AccordionItem key={f.q} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-sm font-semibold">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-10 rounded-2xl border border-primary/40 bg-card/50 p-6 md:p-10">
          <p className="font-display text-2xl font-extrabold tracking-tight">
            $2,995 flat. 3 weeks. One call to start.
          </p>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
            Fixed scope means a fixed price — no surprise invoices, no scope
            creep. If your project needs more than this covers, {NAP.brandName}{" "}
            also takes on custom engagements; we&apos;ll tell you which one
            fits on the call.
          </p>
          <div className="mt-6">
            <WebsitePackageCta location="website_package_final" />
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
