import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LightboxProvider } from "@/components/landing/LightboxProvider";
import { EstimateIntakeClient } from "@/components/estimate/EstimateIntakeClient";

export const metadata: Metadata = {
  title: "Get a project estimate",
  description:
    "Answer a few questions about your project and get a preliminary planning estimate by email, usually within minutes.",
  alternates: { canonical: "/estimate" }
};

const STEPS = [
  {
    title: "Tell us about the project",
    body: "About 7 minutes. The questions adapt to the service you pick, so you only answer what is relevant."
  },
  {
    title: "We price it against a published rate card",
    body: "Hours are estimated per deliverable, then priced by discipline. Nothing is invented on the spot."
  },
  {
    title: "You get a range, not a guess",
    body: "The estimate arrives by email with an itemized breakdown. Vaguer answers produce a wider range — that is the honest result, not a hedge."
  }
] as const;

export default function EstimatePage() {
  return (
    <LightboxProvider>
      <SiteNav />
      <main id="main" className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
        <header className="mb-10 space-y-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Get a preliminary estimate
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Scope your project in about 7 minutes and we&apos;ll send a planning estimate
            with the reasoning behind it. It is not a quote — final scope and price are
            confirmed only after we talk.
          </p>
        </header>

        <ol className="mb-10 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-lg border border-border bg-muted/30 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Step {index + 1}
              </span>
              <h2 className="mt-1 text-sm font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>

        <EstimateIntakeClient />
      </main>
      <SiteFooter />
    </LightboxProvider>
  );
}
