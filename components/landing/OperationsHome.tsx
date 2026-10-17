"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { Reveal } from "./ExperienceProvider";
import { RouteReadyJourney } from "./RouteReadyJourney";
import { ProcessJourney } from "./ProcessJourney";
import { OutcomeVisual } from "./OutcomeVisual";
import { PRICE_RANGE } from "@/lib/jeremy-data";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";

const outcomes = [
  {
    title: "Know where the work stands.",
    problem: "Updates scattered across calls, inboxes, and spreadsheets?",
    answer:
      "Bring responsibilities, records, and next steps into one place, so your team can act without piecing the story together.",
  },
  {
    title: "Give your people a better handoff.",
    problem: "The field finishes the job. The office still has questions.",
    answer:
      "Connect the work on the ground to the people who need it next—with the right details captured at the right moment.",
  },
  {
    title: "Make important steps harder to miss.",
    problem: "A critical process depends on someone remembering.",
    answer:
      "Build checks, approvals, and clear ownership into the workflow, instead of leaving them in someone’s head.",
  },
  {
    title: "A handover, not a cliff.",
    problem: "The build is finished. Your team still needs to use it.",
    answer:
      "Documentation, training, and a clear path forward. Understand what was built, how it works, and what comes next.",
  },
];

export function RouteReadyShowcase() {
  return (
    <section
      id="routeready"
      aria-labelledby="routeready-heading"
      className="scroll-mt-24 border-b border-border py-24 md:py-32"
    >
      <div className="container flex flex-col gap-12">
        <Reveal className="flex flex-col gap-6">
          <h2 id="routeready-heading" className="section-heading">
            Real work.
            <br />
            <span className="text-fg-heading/85">
              A purpose-built solution.
            </span>
          </h2>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            RouteReady puts the approach into practice: new technology applied
            to a specific operational need—driver training for small fleets.
          </p>
        </Reveal>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div className="flex flex-col items-start gap-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-7 text-primary" aria-hidden="true" />
              <span className="font-display text-2xl font-extrabold text-fg-heading">
                RouteReady
              </span>
            </div>
            <h3 className="subsection-heading">
              Prove every driver was trained. Branch by branch.
            </h3>
            <p className="leading-relaxed text-muted-foreground">
              Running a fleet means more than getting vehicles on the road. You
              need to know who has been trained, who signed off, and where the
              records live.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              RouteReady brings training steps, trainer touchpoints, and manager
              sign-off into a documented process—giving small fleet teams a
              clearer way to manage readiness.
            </p>
            <a
              href="https://routereadyhq.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-md font-semibold text-primary underline-offset-4 hover:underline"
            >
              Explore RouteReady{" "}
              <ArrowUpRight className="size-4" aria-hidden="true" />
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          </div>
          <RouteReadyJourney />
        </div>
        <p className="max-w-3xl text-pretty text-lg leading-relaxed text-muted-foreground">
          Your business may not run a fleet. The principle is the same:
          understand the operation, then build the solution around it.
        </p>
      </div>
    </section>
  );
}

export function OperationalOutcomes() {
  return (
    <section
      id="work"
      aria-labelledby="outcomes-heading"
      className="scroll-mt-24 py-24 md:py-32"
    >
      <div className="container flex flex-col gap-12">
        <Reveal className="flex flex-col items-start gap-6">
          <p className="eyebrow">Built around your operation</p>
          <h2 id="outcomes-heading" className="section-heading max-w-4xl">
            Less working around the system.
            <br />
            <span className="text-fg-heading/85">
              More getting the work done.
            </span>
          </h2>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-2">
          {outcomes.map((item, index) => (
            <Reveal key={item.title}>
              <article className="flex h-full flex-col gap-6 rounded-lg border border-border bg-card p-6 md:p-8">
                <OutcomeVisual index={index} />
                <div className="flex items-start gap-4">
                  <span className="pt-1 font-mono text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="flex flex-col gap-4">
                    <h3 className="subsection-heading">
                      {item.title}
                    </h3>
                    <p className="text-base leading-relaxed text-muted-foreground">
                      {item.problem} {item.answer}
                    </p>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
        <Link
          href="/services"
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Explore our services{" "}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

export function OperationalApproach() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="approach-heading"
      className="scroll-mt-24 border-y border-border bg-muted py-24 md:py-32"
    >
      <div className="container flex flex-col gap-12">
        <Reveal className="flex flex-col gap-6">
          <p className="eyebrow">Our approach</p>
          <h2 id="approach-heading" className="section-heading">
            First, your operation.
            <br />
            <span className="text-fg-heading/85">Then, the technology.</span>
          </h2>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Not a template with your logo on it. Not a quick tool built around
            the latest trend. A considered solution to a problem worth solving.
          </p>
        </Reveal>
        <ProcessJourney />
      </div>
    </section>
  );
}

export function OperationsQuestions() {
  return (
    <section
      id="faq"
      aria-labelledby="questions-heading"
      className="scroll-mt-24 py-24 md:py-32"
    >
      <div className="container flex flex-col gap-10 lg:flex-row lg:gap-20">
        <h2 id="questions-heading" className="section-heading lg:w-5/12">
          A few fair questions.
        </h2>
        <div className="flex flex-1 flex-col divide-y divide-border">
          {[
            [
              "Is this only for fleet businesses?",
              "No. RouteReady is one example of an operational solution. We also work with businesses whose teams need better coordination, clearer records, or systems that fit the way they work.",
            ],
            [
              "Do I need to know what software I want?",
              "No. Start with the problem, not a feature list. Tell us what happens today and what you wish were different. We can work out the right approach together.",
            ],
            [
              "Will you replace all our existing systems?",
              "Not by default. We look at what you already use and where it falls short. The right solution may connect existing tools, improve a single workflow, or require something custom.",
            ],
            [
              "What happens after the first conversation?",
              "We clarify the operational need and whether we are a good fit. Before development, we agree on scope, responsibilities, and cost. There is no instant, one-size-fits-all quote.",
            ],
          ].map(([question, answer]) => (
            <details key={question} className="group py-5 first:pt-0">
              <summary className="cursor-pointer rounded-md font-display text-lg font-bold underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {question}
              </summary>
              <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
                {answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function OperationsContact({ heading }: { heading: ReactNode }) {
  const { open } = useLightbox();
  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="scroll-mt-24 pb-24 md:pb-32"
    >
      <div className="container">
        <Reveal className="rounded-lg border border-border bg-card">
          <div className="flex flex-col items-start gap-8 px-7 py-12 md:p-16">
            {heading}
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Tell us where the work gets stuck, who it affects, and what a
              better day would look like. You don&apos;t need a technical brief.
            </p>
            <div className="flex max-w-full flex-col items-start gap-4">
              <Button
                size="lg"
                className="h-auto min-h-14 max-w-full whitespace-normal rounded-pill px-6 py-4"
                onClick={() => open("intake")}
              >
                Tell us about your operation{" "}
                <ArrowUpRight
                  className="ml-2 size-4 shrink-0"
                  aria-hidden="true"
                />
              </Button>
              <button
                type="button"
                onClick={() => open("book")}
                className="min-h-11 rounded-md text-left text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Prefer to talk it through? Book a conversation.
              </button>
              <button
                type="button"
                onClick={() => open("email")}
                className="min-h-11 rounded-md text-left text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Or send a note.
              </button>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {PRICE_RANGE.display} typical engagement. We review the
              operational need first, then agree on scope, responsibilities, and
              cost. Not an instant quote.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
