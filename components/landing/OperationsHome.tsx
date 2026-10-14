"use client";

import { ArrowRight, Check, ClipboardCheck, FileCheck2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";

const outcomes = [
  { title: "Know where the work stands.", problem: "Updates scattered across calls, inboxes, and spreadsheets?", answer: "Bring responsibilities, records, and next steps into one place, so your team can act without piecing the story together." },
  { title: "Give your people a better handoff.", problem: "The field finishes the job. The office still has questions.", answer: "Connect the work on the ground to the people who need it next—with the right details captured at the right moment." },
  { title: "Make important steps harder to miss.", problem: "A critical process depends on someone remembering.", answer: "Build checks, approvals, and clear ownership into the workflow, instead of leaving them in someone’s head." },
];
const steps = [
  ["Understand the work.", "We walk through the day-to-day with you: who does what, where things break down, and which exceptions matter. No solution before we understand the problem."],
  ["Design the right fit.", "Together we define what better looks like, what the system needs to connect to, and a clear scope. Sometimes the right answer is improving what you already have."],
  ["Build it. Use it. Refine it.", "We develop the solution, work through real scenarios with your team, and support the handover. The goal is something people can actually rely on—not just a successful demo."],
];

export function RouteReadyShowcase() {
  return (
    <section id="routeready" aria-labelledby="routeready-heading" className="scroll-mt-24 bg-card/50 py-20 md:py-28">
      <div className="container flex max-w-7xl flex-col gap-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="routeready-heading" className="max-w-2xl text-balance font-display text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">Real work.<br />A purpose-built solution.</h2>
          <p className="max-w-md text-lg leading-relaxed text-muted-foreground">RouteReady puts the approach into practice: new technology applied to a specific operational need—driver training for small fleets.</p>
        </div>
        <article className="overflow-hidden rounded-2xl border border-border bg-background">
          <div className="flex flex-col lg:flex-row">
            <div className="flex flex-col items-start gap-6 p-7 md:p-12 lg:w-5/12">
              <div className="flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-primary" aria-hidden="true" /><span className="font-display text-2xl font-extrabold">RouteReady</span></div>
              <h3 className="text-balance font-display text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">Prove every driver was trained. Branch by branch.</h3>
              <p className="leading-relaxed text-muted-foreground">Running a fleet means more than getting vehicles on the road. You need to know who has been trained, who signed off, and where the records live.</p>
              <p className="leading-relaxed text-muted-foreground">RouteReady brings training steps, trainer touchpoints, and manager sign-off into a documented process—giving small fleet teams a clearer way to manage readiness.</p>
              <a href="https://routereadyhq.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md font-semibold text-primary underline-offset-4 hover:underline">Explore RouteReady <ArrowRight className="h-4 w-4" aria-hidden="true" /><span className="sr-only"> (opens in new tab)</span></a>
            </div>
            <div className="flex flex-col justify-center gap-6 border-t border-border bg-muted/40 p-6 md:p-12 lg:w-7/12 lg:border-l lg:border-t-0">
              <div className="flex items-center justify-between gap-4"><span className="inline-flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="h-4 w-4 text-primary" aria-hidden="true" />Driver training journey</span><span className="text-xs text-muted-foreground">Process illustration</span></div>
              <div className="overflow-hidden rounded-xl border border-border bg-background">
                <div className="flex flex-col gap-2 border-b border-border p-6"><p className="font-display text-xl font-extrabold">From first ride to final sign-off.</p><p className="text-sm text-muted-foreground">One process. A clear record at every step.</p></div>
                <ol className="divide-y divide-border">{["Ride-along begins", "Trainer records progress", "Manager reviews and signs", "Training packet is ready"].map((step) => <li key={step} className="flex items-center gap-4 px-6 py-5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Check className="h-4 w-4" aria-hidden="true" /></span><span className="text-sm font-semibold md:text-base">{step}</span></li>)}</ol>
                <div className="flex items-center gap-3 border-t border-border bg-card px-6 py-4 text-sm text-muted-foreground"><FileCheck2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />Training evidence stays with the record.</div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">The technology is the means. A training process your team can follow and document is the point.</p>
            </div>
          </div>
        </article>
        <p className="max-w-3xl text-pretty text-lg leading-relaxed text-muted-foreground">Your business may not run a fleet. The principle is the same: understand the operation, then build the solution around it.</p>
      </div>
    </section>
  );
}

export function OperationalOutcomes() {
  return <section id="work" aria-labelledby="outcomes-heading" className="scroll-mt-24 py-20 md:py-28"><div className="container max-w-7xl"><h2 id="outcomes-heading" className="max-w-3xl text-balance font-display text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">Less working around the system.<br /><span className="text-muted-foreground">More getting the work done.</span></h2><div className="mt-12 flex flex-col divide-y divide-border">{outcomes.map((item) => <article key={item.title} className="flex flex-col gap-5 py-8 md:flex-row md:gap-12"><div className="flex flex-col gap-3 md:w-1/2"><h3 className="font-display text-2xl font-extrabold">{item.title}</h3><p className="text-sm text-muted-foreground">{item.problem}</p></div><p className="max-w-xl leading-relaxed text-muted-foreground md:w-1/2">{item.answer}</p></article>)}</div></div></section>;
}

export function OperationalApproach() {
  return <section id="how-it-works" aria-labelledby="approach-heading" className="scroll-mt-24 border-y border-border bg-card/50 py-20 md:py-28"><div className="container flex max-w-7xl flex-col gap-12 lg:flex-row lg:gap-20"><div className="flex flex-col gap-6 lg:w-5/12"><h2 id="approach-heading" className="text-balance font-display text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">First, your operation.<br />Then, the technology.</h2><p className="text-lg leading-relaxed text-muted-foreground">Not a template with your logo on it. Not a quick tool built around the latest trend. A considered solution to a problem worth solving.</p></div><ol className="flex flex-1 flex-col gap-10">{steps.map(([title, body]) => <li key={title} className="flex flex-col gap-3 border-b border-border pb-8 last:border-0 last:pb-0"><h3 className="font-display text-2xl font-extrabold">{title}</h3><p className="leading-relaxed text-muted-foreground">{body}</p></li>)}</ol></div></section>;
}

export function OperationsQuestions() {
  return <section id="faq" aria-labelledby="questions-heading" className="py-20 md:py-28"><div className="container flex max-w-7xl flex-col gap-10 lg:flex-row lg:gap-20"><h2 id="questions-heading" className="font-display text-4xl font-extrabold tracking-tight lg:w-5/12">A few fair questions.</h2><div className="flex flex-1 flex-col divide-y divide-border">{[
    ["Is this only for fleet businesses?", "No. RouteReady is one example of an operational solution. We also work with businesses whose teams need better coordination, clearer records, or systems that fit the way they work."],
    ["Do I need to know what software I want?", "No. Start with the problem, not a feature list. Tell us what happens today and what you wish were different. We can work out the right approach together."],
    ["Will you replace all our existing systems?", "Not by default. We look at what you already use and where it falls short. The right solution may connect existing tools, improve a single workflow, or require something custom."],
    ["What happens after the first conversation?", "We clarify the operational need and whether we are a good fit. Before development, we agree on scope, responsibilities, and cost. There is no instant, one-size-fits-all quote."],
  ].map(([question, answer]) => <details key={question} className="group py-5 first:pt-0"><summary className="cursor-pointer rounded-md font-display text-lg font-bold underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{question}</summary><p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">{answer}</p></details>)}</div></div></section>;
}

export function OperationsContact() {
  const { open } = useLightbox();
  return <section id="contact" aria-labelledby="contact-heading" className="border-t border-border bg-card py-20 md:py-28"><div className="container flex max-w-7xl flex-col items-start gap-7"><h2 id="contact-heading" className="max-w-4xl text-balance font-display text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">You know what&apos;s not working.<br /><span className="text-primary">Let&apos;s work out what would.</span></h2><p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">Tell us where the work gets stuck, who it affects, and what a better day would look like. You don&apos;t need a technical brief.</p><Button size="lg" className="h-auto rounded-full px-7 py-4" onClick={() => open("form")}>Tell us about your operation <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Button><button type="button" onClick={() => open("book")} className="rounded-md text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">Prefer to talk it through? Book a conversation.</button></div></section>;
}
