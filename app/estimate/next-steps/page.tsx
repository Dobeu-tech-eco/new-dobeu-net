import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LightboxProvider } from "@/components/landing/LightboxProvider";

export const metadata: Metadata = {
  title: "Your estimate is on the way",
  description: "What happens after you submit the Dobeu Tech Solutions project scope intake.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/estimate/next-steps" }
};

const TIMELINE = [
  {
    when: "Within a few minutes",
    what: "The estimate lands in your inbox with an itemized breakdown — the hours behind each line, the multipliers applied, and why the range is as wide or as narrow as it is."
  },
  {
    when: "Within one business day",
    what: "Jeremy reads the answers himself and replies. If anything in your brief changes the number materially, you hear that before you hear a sales pitch."
  },
  {
    when: "When you're ready",
    what: "A scoping call turns the range into a fixed price and a written scope. Nothing is binding until you accept it in writing."
  }
] as const;

export default function EstimateNextStepsPage() {
  return (
    <LightboxProvider>
      <SiteNav />
      <main id="main" className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Your estimate is on the way
        </h1>
        <p className="mt-4 text-muted-foreground">
          Thanks for taking the time to scope it properly — the detail you gave is what makes
          the number worth anything.
        </p>

        <ol className="mt-10 space-y-6">
          {TIMELINE.map((entry) => (
            <li key={entry.when} className="border-l-2 border-border pl-5">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {entry.when}
              </div>
              <p className="mt-1 text-sm">{entry.what}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-lg border border-border bg-muted/30 p-5">
          <h2 className="text-sm font-semibold">Nothing after 15 minutes?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Check spam first. If it still hasn&apos;t arrived, email{" "}
            <a className="underline underline-offset-2" href="mailto:jeremyw@dobeu.net">
              jeremyw@dobeu.net
            </a>{" "}
            and we&apos;ll send it over directly.
          </p>
        </div>

        <div className="mt-8">
          <Button asChild variant="outline">
            <Link href="/">Back to dobeu.net</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </LightboxProvider>
  );
}
