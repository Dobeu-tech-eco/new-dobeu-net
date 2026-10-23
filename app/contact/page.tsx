import type { Metadata } from "next";
import { LeadForm } from "@/components/landing/LeadForm";
import { MarketingPageHeader, MarketingShell } from "@/components/landing/MarketingShell";
import { NAP } from "@/lib/jeremy-data";

export const metadata: Metadata = {
  title: "Contact",
  description: "Share an idea or explore a collaboration with Jeremy at Dobeu.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader eyebrow="Contact" title="Let's build something useful."
        description="Share an idea, a project, or a common interest. I'd like to hear what you have in mind." />
      <section aria-label="Collaboration form" className="container max-w-6xl py-10 md:py-16">
        <div className="max-w-2xl">
          <LeadForm source="form" />
          <p className="mt-8 text-sm text-muted-foreground">
            Prefer email? <a className="text-primary underline underline-offset-4" href={`mailto:${NAP.email}`}>{NAP.email}</a>
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
