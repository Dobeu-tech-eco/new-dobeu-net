import type { Metadata } from "next";
import Link from "next/link";
import { EstimateCtas } from "@/components/landing/EstimateCtas";
import { MarketingPageHeader, MarketingShell } from "@/components/landing/MarketingShell";

// Old direct links landed on a fixed-price brochure site. That offer is gone.
// Keep the route so those links still resolve, and keep it out of the index.
export const metadata: Metadata = {
  title: "Not a brochure site",
  description:
    "Dobeu does not sell a fixed-price webpage. The work is a partnership on the actual fleet job.",
  alternates: { canonical: "/website-package" },
  robots: { index: false, follow: false },
};

export default function WebsitePackagePage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        eyebrow="Not this"
        title="This is not a brochure site."
        description="The old fixed-price webpage is gone. If you wanted five pages and a ticket number, there is a whole industry for that. The work here is a partnership on the actual job — usually a small fleet — and a product only if that work earns it."
      />
      <section className="container max-w-6xl pb-16 space-y-8">
        <p className="max-w-2xl text-base text-muted-foreground leading-relaxed">
          RouteReady is the fleet example, and it is not launched from this
          site. Tell me the job if you want to talk.
        </p>
        <EstimateCtas location="website_package" />
        <p className="text-sm text-muted-foreground">
          <Link href="/#pipeline" className="underline underline-offset-4 hover:text-foreground">
            What&apos;s in the pipeline
          </Link>
        </p>
      </section>
    </MarketingShell>
  );
}
